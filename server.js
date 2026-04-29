// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Quick check that this service is the API (useful for Railway / DNS / wrong-service debugging)
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'buffbuzz-api' });
});

// Email transporter configuration (short timeouts so signup doesn’t hang when SMTP is blocked, e.g. on Railway)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 15_000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Optional SMTP check on startup. Many hosts (e.g. Railway) block or throttle outbound
// port 587 to smtp.gmail.com, so verify() times out even when the API is fine.
// Set EMAIL_VERIFY_ON_START=true only when debugging mail; sending still uses the transporter on demand.
if (process.env.EMAIL_VERIFY_ON_START === 'true' && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter.verify((error) => {
    if (error) {
      console.error('Email configuration error:', error);
    } else {
      console.log('Email server is ready to send messages');
    }
  });
} else if (process.env.EMAIL_USER) {
  console.log(
    'Email: startup SMTP verify skipped. Mail features need working SMTP; from cloud, prefer an HTTP provider (e.g. Resend, SendGrid) or set EMAIL_VERIFY_ON_START=true to test verify.'
  );
}

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize email to lowercase for case-insensitive auth and consistent DB storage
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const NEWSLETTER_MAX_WORDS = 500;

function wordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

// Parse post imageUrl: supports JSON array (multiple images) or single URL
function parsePostImages(imageUrl) {
  if (!imageUrl) return [];
  if (typeof imageUrl !== 'string') return [];
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr : [imageUrl];
    } catch {
      return [imageUrl];
    }
  }
  return [imageUrl];
}

/** Polls: attach vote counts, optional voter lists (non-anonymous), and current user's vote. */
async function enrichPollsForPosts(posts, viewerUserId) {
  const withPoll = posts.filter((p) => p.poll);
  if (withPoll.length === 0) return posts;

  const pollIds = withPoll.map((p) => p.poll.id);
  const nonAnonPollIds = withPoll.filter((p) => !p.poll.anonymousVoting).map((p) => p.poll.id);

  const [myVotes, voterRows] = await Promise.all([
    viewerUserId
      ? prisma.pollVote.findMany({
          where: { userId: viewerUserId, pollId: { in: pollIds } },
          select: { pollId: true, optionId: true }
        })
      : Promise.resolve([]),
    nonAnonPollIds.length > 0
      ? prisma.pollVote.findMany({
          where: { pollId: { in: nonAnonPollIds } },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: { select: { profilePictureUrl: true } }
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const myVoteByPoll = new Map(myVotes.map((v) => [v.pollId, v.optionId]));
  const votersByPollOption = new Map();
  for (const v of voterRows) {
    const key = `${v.pollId}:${v.optionId}`;
    if (!votersByPollOption.has(key)) votersByPollOption.set(key, []);
    votersByPollOption.get(key).push({
      id: v.user.id,
      firstName: v.user.firstName,
      lastName: v.user.lastName,
      profile: v.user.profile
    });
  }

  return posts.map((post) => {
    if (!post.poll) return post;
    const p = post.poll;
    const options = (p.options || []).map((opt) => {
      const voteCount = opt._count?.votes ?? 0;
      const voters = p.anonymousVoting
        ? null
        : votersByPollOption.get(`${p.id}:${opt.id}`) || [];
      return {
        id: opt.id,
        text: opt.text,
        sortOrder: opt.sortOrder,
        voteCount,
        voters
      };
    });
    const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
    const expiresAt = p.expiresAt ? p.expiresAt.toISOString() : null;
    const isExpired = p.expiresAt ? new Date(p.expiresAt) <= new Date() : false;
    const pollClient = {
      id: p.id,
      anonymousVoting: p.anonymousVoting,
      expiresAt,
      isExpired,
      options,
      myVoteOptionId: viewerUserId ? (myVoteByPoll.get(p.id) ?? null) : null,
      totalVotes
    };
    const { poll: _raw, ...rest } = post;
    return { ...rest, poll: pollClient };
  });
}

async function shouldNotify(userId, type) {
  try {
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });
    if (!prefs) return true;

    // Check permanent mute
    if (prefs.muteAll) return false;

    // Check temporary mute — if muteUntil is in the future, silence everything
    if (prefs.muteUntil && prefs.muteUntil > new Date()) return false;

    // If muteUntil has expired, clear it automatically
    if (prefs.muteUntil && prefs.muteUntil <= new Date()) {
      await prisma.notificationPreferences.update({
        where: { userId },
        data: { muteUntil: null }
      });
    }

    switch (type) {
      case 'like':                return prefs.postLikes;
      case 'comment':             return prefs.comments;
      case 'reply':               return prefs.commentReplies;
      case 'mention':             return prefs.mentions;
      case 'group_chat_mention':  return prefs.mentions;
      case 'lostfound_listing':   return prefs.lostFoundNew;
      case 'lostfound_resolved':  return prefs.lostFoundResolved ?? prefs.lostFoundNew;
      case 'group_join_request':  return prefs.groupJoinRequests;
      case 'group_join_approved': return prefs.groupJoinResponse;
      case 'group_join_denied':   return prefs.groupJoinResponse;
      case 'direct_message':      return prefs.pushNotifications;
      case 'group_message':       return prefs.groupNewPost;
      case 'group_new_post':      return prefs.groupNewPost;
      case 'group_announcement':  return prefs.groupNewPost;
      case 'group_event':         return prefs.groupNewPost;
      case 'group_poll':          return prefs.groupNewPost;
      case 'security_alert':      return true;
      case 'marketplace_listing': return true;
      case 'platform_announcement': return true;
      case 'newsletter_post': return true;
      default:                    return true;
    }
  } catch {
    return true;
  }
}

// Send verification email
async function sendVerificationEmail(email, verificationCode, firstName) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email not configured');
  }
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your BuffBuzz Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .code { font-size: 32px; font-weight: bold; color: #4CAF50; text-align: center; padding: 20px; background-color: #fff; border: 2px dashed #4CAF50; border-radius: 5px; margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to BuffBuzz! 🎓</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>Thanks for signing up for BuffBuzz. To complete your registration, please verify your email address using the code below:</p>
            
            <div class="code">${verificationCode}</div>
            
            <p>Enter this code on the verification page to activate your account.</p>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code will expire in 15 minutes</li>
              <li>You have 3 attempts to enter the correct code</li>
              <li>If you didn't create an account with BuffBuzz, please ignore this email</li>
            </ul>
            
            <p>If you're having trouble, feel free to contact our support team.</p>
            
            <p>Best regards,<br>The BuffBuzz Team</p>
          </div>
          <div class="footer">
            <p>© 2025 BuffBuzz. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send verification email');
  }
}

// Send password reset email
async function sendPasswordResetEmail(email, resetToken, firstName) {
  const resetLink = `http://localhost:5000/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'BuffBuzz - Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #800000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; background-color: #800000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .link { color: #666; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>You requested to reset your password for your BuffBuzz account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p class="link">${resetLink}</p>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Your password won't change until you create a new one</li>
            </ul>
            
            <p>Best regards,<br>The BuffBuzz Team</p>
          </div>
          <div class="footer">
            <p>© 2025 BuffBuzz. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw new Error('Failed to send reset email');
  }
}

// Send account locked email (when too many failed login attempts)
async function sendAccountLockedEmail(email, firstName, lockMinutes) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'BuffBuzz - Account Temporarily Locked',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #800000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Temporarily Locked</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>Your BuffBuzz account has been temporarily locked due to too many failed login attempts.</p>
            <p>Your account will be unlocked in <strong>${lockMinutes} minutes</strong>.</p>
            <p>If you did not attempt to log in, please change your password as soon as your account is unlocked.</p>
            <p>Best regards,<br>The BuffBuzz Team</p>
          </div>
          <div class="footer">
            <p>© 2025 BuffBuzz. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending lock email:', error);
    throw error;
  }
}

async function sendPasswordChangedEmail(email, firstName) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'BuffBuzz - Your Password Was Changed',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #800000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .alert-box { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 16px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🔐 Security Alert</h1></div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>Your BuffBuzz account password was successfully changed.</p>
            <div class="alert-box">
              <strong>⚠️ If you did not make this change:</strong>
              <p style="margin: 8px 0 0 0;">Your account may have been compromised. Please reset your password immediately using the "Forgot Password" option on the login page.</p>
            </div>
            <p><strong>When:</strong> ${new Date().toLocaleString()}</p>
            <p>If you made this change, you can safely ignore this email.</p>
            <p>Best regards,<br>The BuffBuzz Team</p>
          </div>
          <div class="footer"><p>© 2025 BuffBuzz. All rights reserved.</p></div>
        </div>
      </body>
      </html>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password change alert sent to ${email}`);
  } catch (error) {
    console.error('Error sending password change email:', error);
    // Don't throw — email failure should not block the password change
  }
}
// ==================== AUTHENTICATION ENDPOINTS ====================

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    const { email, password, firstName, lastName, userType } = req.body;

    if (!email || !password || !firstName || !lastName || !userType) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (/\s/.test(password)) {
      return res.status(400).json({ message: 'Password cannot contain spaces' });
    }

    if (userType !== 'student' && userType !== 'professor') {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    const emailNormalized = normalizeEmail(email);
    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    // Create user with PENDING verification status (store email in lowercase)
    const user = await prisma.user.create({
      data: {
        email: emailNormalized,
        password: hashedPassword,
        firstName,
        lastName,
        userType: userType.toUpperCase(),
        verificationCode,
        verificationStatus: 'PENDING'
      }
    });

    console.log('User created successfully:', user.email);

    // Send verification email
    try {
      await sendVerificationEmail(emailNormalized, verificationCode, firstName);
      
      res.status(201).json({
        message: 'Account created successfully! Please check your email for the verification code.',
        userId: user.id,
        email: user.email
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(201).json({
        message: 'Account created but email failed to send. Verification code: ' + verificationCode,
        userId: user.id,
        email: user.email,
        verificationCode: verificationCode
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'An error occurred during registration' });
  }
});

// Resend verification code endpoint
app.post('/api/resend-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailNormalized = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNormalized, mode: 'insensitive' } }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verificationStatus === 'VERIFIED') {
      return res.status(400).json({ message: 'User already verified' });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();

    // Update user with new code and reset attempts (use id so casing doesn't matter)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationAttempts: 0
      }
    });

    console.log(`New verification code generated for ${emailNormalized}: ${verificationCode}`);

    // Optionally normalize stored email to lowercase
    if (user.email !== emailNormalized) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: emailNormalized }
      });
    }

    // Send verification email
    try {
      await sendVerificationEmail(emailNormalized, verificationCode, user.firstName);
      
      res.status(200).json({
        message: 'Verification code resent successfully! Please check your email.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({
        message: 'Failed to send email. Verification code: ' + verificationCode,
        verificationCode: verificationCode
      });
    }

  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ message: 'An error occurred while resending the code' });
  }
});

// Enhanced Verification endpoint
app.post('/api/verify', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const emailNormalized = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNormalized, mode: 'insensitive' } }
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'Account not found. Please sign up again.' 
      });
    }

    // If already verified, let them know they can log in
    if (user.verificationStatus === 'VERIFIED') {
      return res.status(200).json({ 
        message: 'Email already verified! You can log in now.',
        alreadyVerified: true
      });
    }

    // Check if verification code exists
    if (!user.verificationCode) {
      return res.status(400).json({ 
        message: 'No verification code found. Please request a new code.',
        needsNewCode: true
      });
    }

    // Check if too many attempts
    if (user.verificationAttempts >= 3) {
      return res.status(400).json({ 
        message: 'Too many failed attempts. Please request a new verification code.',
        needsNewCode: true
      });
    }

    // Check if verification code matches
    if (user.verificationCode !== verificationCode) {
      // Increment failed attempts
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { verificationAttempts: user.verificationAttempts + 1 }
      });

      const remainingAttempts = 3 - updatedUser.verificationAttempts;
      
      if (remainingAttempts <= 0) {
        return res.status(400).json({ 
          message: 'Too many failed attempts. Please request a new verification code.',
          needsNewCode: true
        });
      }

      return res.status(400).json({ 
        message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
        attemptsRemaining: remainingAttempts
      });
    }

    // Successful verification - update user to verified
    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: emailNormalized,
        verificationStatus: 'VERIFIED',
        verificationCode: null,
        verificationAttempts: 0
      }
    });

    console.log(`Email verified successfully for user: ${verifiedUser.email}`);

    const { password: _, ...userWithoutPassword } = verifiedUser;

    res.status(200).json({
      message: 'Email verified successfully! Welcome to BuffBuzz!',
      user: userWithoutPassword,
      verified: true
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'An error occurred during verification' });
  }
});

// ----------- SEARCH USERS -------------
app.get('/api/search-users', async (req, res) => {
  try {
    const query = (req.query.query || req.query.q || '').trim();

    if (!query) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        verificationStatus: 'VERIFIED', // Only show verified accounts
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profile: {
          select: { profilePictureUrl: true }
        }
      },
      take: 10
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      profilePictureUrl: user.profile?.profilePictureUrl || null
    }));

    res.json({ users: formattedUsers });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error searching users' });
  }
});


// Login endpoint with attempt tracking
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const emailNormalized = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNormalized, mode: 'insensitive' } }
    });

    // Normalize stored email to lowercase when user logs in (one-time migration)
    if (user && user.email !== emailNormalized) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: emailNormalized }
      });
      user.email = emailNormalized;
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.verificationStatus !== 'VERIFIED') {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    if (user.suspended) {
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact support.'
       });
      }

    console.log('=== LOGIN ATTEMPT DEBUG ===');
    console.log('User email:', user.email);
    console.log('Current loginAttempts:', user.loginAttempts);
    console.log('Current lockUntil:', user.lockUntil);
    console.log('==========================');

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - new Date()) / 60000);
      console.log('ACCOUNT IS LOCKED! Time remaining:', lockTimeRemaining, 'minutes');
      return res.status(423).json({ 
        message: `Account locked due to too many failed login attempts. Try again in ${lockTimeRemaining} minute${lockTimeRemaining === 1 ? '' : 's'}.`,
        locked: true,
        lockTimeRemaining
      });
    }

    // If lock time has expired, reset login attempts
    if (user.lockUntil && user.lockUntil <= new Date()) {
      console.log('Lock expired, resetting attempts');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null
        }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log('INVALID PASSWORD - Incrementing attempts');
      
      // Increment login attempts
      const MAX_LOGIN_ATTEMPTS = 5;
      const LOCK_TIME_MINUTES = 15;
      const newAttempts = user.loginAttempts + 1;
      
      console.log('New attempt count will be:', newAttempts);
      
      const updateData = {
        loginAttempts: newAttempts
      };

      // Lock account if max attempts reached
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
        updateData.lockUntil = lockUntil;
        
        console.log('MAX ATTEMPTS REACHED! Locking account until:', lockUntil);
        
        // Update user
        await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });

        // Send email notification about account lock
        try {
          await sendAccountLockedEmail(user.email, user.firstName, LOCK_TIME_MINUTES);
          console.log('Lock email sent successfully');
        } catch (emailError) {
          console.error('Failed to send lock notification email:', emailError);
        }

        return res.status(423).json({ 
          message: `Account locked due to too many failed login attempts. Try again in ${LOCK_TIME_MINUTES} minutes. Check your email for more information.`,
          locked: true,
          lockTimeRemaining: LOCK_TIME_MINUTES
        });
      }

      // Update attempts without locking
      console.log('Updating login attempts to:', newAttempts);
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });

      const attemptsLeft = MAX_LOGIN_ATTEMPTS - newAttempts;
      console.log('Attempts left:', attemptsLeft);
      
      return res.status(401).json({ 
        message: `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before account lock.`,
        attemptsRemaining: attemptsLeft
      });
    }

    // Successful login - reset attempts if any existed
    if (user.loginAttempts > 0 || user.lockUntil) {
      console.log('SUCCESSFUL LOGIN - Resetting attempts');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null
        }
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    console.log(`Successful login for user: ${user.email}`);

    res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login' });
  }
});

// Request password reset endpoint
app.post('/api/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailNormalized = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNormalized, mode: 'insensitive' } }
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists with this email, you will receive a reset link.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database (use id)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    console.log(`Reset token generated for ${emailNormalized}`);

    // Normalize stored email to lowercase
    if (user.email !== emailNormalized) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: emailNormalized }
      });
    }

    // Send reset email
    try {
      await sendPasswordResetEmail(emailNormalized, resetToken, user.firstName);
      
      res.status(200).json({ 
        message: 'If an account exists with this email, you will receive a reset link.' 
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({
        message: 'Failed to send email. Please try again later.'
      });
    }

  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});

// Reset password with token endpoint
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Token must not be expired
        }
      }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired reset token. Please request a new reset link.' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    console.log(`Password reset successful for user: ${user.email}`);

    res.status(200).json({ message: 'Password reset successful!' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});

// ==================== PROFILE ENDPOINTS ====================

// Get user profile with privacy checks
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.query.viewerId;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Default to PUBLIC if privacy is not set
    const privacy = profile.privacy || 'PUBLIC';
    const isOwner = viewerId && viewerId === userId;
    let canViewFullProfile = false;

    if (isOwner) {
      canViewFullProfile = true;
    } else if (privacy === 'PUBLIC') {
      canViewFullProfile = true;
    } else if (privacy === 'FRIENDS_ONLY' && viewerId) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
          ]
        }
      });
      canViewFullProfile = !!friendship;
    }

    // If can view full profile, return everything
    if (canViewFullProfile) {
      return res.status(200).json({ 
        profile: profile,
        canViewFullProfile: true,
        privacy: privacy
      });
    }

    // Otherwise, return limited data
    const limitedProfile = {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      pronouns: profile.pronouns,
      profilePictureUrl: profile.profilePictureUrl,
      privacy: privacy,
      user: {
        id: profile.user.id,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: null // Hide email
      },
      // Hide everything else
      bio: null,
      major: null,
      department: null,
      graduationYear: null,
      classification: null,
      clubs: null,
      instagramHandle: null,
      linkedinUrl: null,
      facebookHandle: null
    };

    res.status(200).json({ 
      profile: limitedProfile,
      canViewFullProfile: false,
      privacy: privacy
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the profile' });
  }
});

// Create or update profile
app.put('/api/profile/update', async (req, res) => {
  try {
    const {
      userId,
      name,
      pronouns,
      bio,
      major,
      department,
      graduationYear,
      classification,
      clubs,
      instagramHandle,
      linkedinUrl,
      facebookHandle,
      profilePictureUrl,
      privacy
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Validate privacy level if provided
    if (privacy && !['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'].includes(privacy)) {
      return res.status(400).json({ message: 'Invalid privacy level. Must be PUBLIC, FRIENDS_ONLY, or PRIVATE' });
    }

    const updateData = {
      name,
      pronouns,
      bio,
      major,
      department,
      graduationYear,
      classification,
      clubs,
      instagramHandle,
      linkedinUrl,
      facebookHandle,
      profilePictureUrl
    };

    // Only update privacy if provided
    if (privacy) {
      updateData.privacy = privacy;
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
        privacy: privacy || 'PUBLIC' // Default to PUBLIC if not specified
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      profile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'An error occurred while updating the profile' });
  }
});

// ==================== POST ENDPOINTS ====================

// Create a post
app.post('/api/posts/create', async (req, res) => {
  try {
    const {
      title,
      content,
      imageUrl,
      imageUrls,
      authorId,
      groupId,
      postType,
      pollOptions,
      anonymousVoting,
      expiresAt
    } = req.body;

    const resolvedType = postType || 'POST';

    if (resolvedType !== 'POLL' && (!title || !content || !authorId)) {
      return res.status(400).json({ message: 'Title, content, and author are required' });
    }
    if (resolvedType === 'POLL' && (!title?.trim() || !authorId)) {
      return res.status(400).json({ message: 'Title and author are required' });
    }

    // If posting to a group, verify the author is a member
    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: authorId } }
      });
      if (!membership) {
        return res.status(403).json({ message: 'You must be a group member to post here' });
      }
    }

    if (resolvedType === 'POLL') {
      const rawOpts = Array.isArray(pollOptions) ? pollOptions : [];
      const options = rawOpts.map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2 || options.length > 5) {
        return res.status(400).json({ message: 'Poll must have between 2 and 5 non-empty options' });
      }
      let expiresAtDate = null;
      if (expiresAt != null && String(expiresAt).trim() !== '') {
        expiresAtDate = new Date(expiresAt);
        if (Number.isNaN(expiresAtDate.getTime())) {
          return res.status(400).json({ message: 'Invalid expiration date' });
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            title,
            content: typeof content === 'string' ? content : '',
            imageUrl: null,
            authorId,
            groupId: groupId || null,
            postType: 'POLL'
          },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        });
        const poll = await tx.poll.create({
          data: {
            postId: post.id,
            anonymousVoting: !!anonymousVoting,
            expiresAt: expiresAtDate
          }
        });
        await tx.pollOption.createMany({
          data: options.map((text, i) => ({
            pollId: poll.id,
            text,
            sortOrder: i
          }))
        });
        const fullPoll = await tx.poll.findUnique({
          where: { id: poll.id },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: { _count: { select: { votes: true } } }
            }
          }
        });
        return { post, poll: fullPoll };
      });

      if (groupId) {
        const groupMembers = await prisma.groupMember.findMany({
          where: { groupId, userId: { not: authorId } },
          select: { userId: true }
        });
        const notifType = 'group_poll';
        for (const member of groupMembers) {
          if (await shouldNotify(member.userId, 'group_message')) {
            await prisma.notification.create({
              data: {
                recipientId: member.userId,
                actorId: authorId,
                type: notifType,
                postId: created.post.id,
                groupId
              }
            });
          }
        }
      }

      const [enriched] = await enrichPollsForPosts(
        [{ ...created.post, poll: created.poll }],
        authorId
      );
      return res.status(201).json({ message: 'Poll created successfully', post: enriched });
    }

    let storedImageUrl = imageUrl;
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      storedImageUrl = JSON.stringify(imageUrls);
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        imageUrl: storedImageUrl,
        authorId,
        groupId: groupId || null,
        postType: resolvedType
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // If this is a group post, notify all other group members
    if (groupId) {
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: authorId } },
    select: { userId: true }
  });

  const notifType = resolvedType === 'ANNOUNCEMENT'
    ? 'group_announcement'
    : resolvedType === 'EVENT'
    ? 'group_event'
    : 'group_new_post';

  for (const member of groupMembers) {
    if (await shouldNotify(member.userId, 'group_message')) {
      await prisma.notification.create({
        data: {
          recipientId: member.userId,
          actorId: authorId,
          type: notifType,
          postId: post.id,
          groupId
        }
      });
    }
  }
}

    res.status(201).json({ message: 'Post created successfully', post });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'An error occurred while creating the post' });
  }
});

// Get all posts (optional authorId = posts by that user on the main feed only, groupId null)
app.get('/api/posts', async (req, res) => {
  try {
    const { userId, authorId } = req.query; // userId: viewer for like status; authorId: filter by author

    const where = {
      groupId: null // Only main-feed posts, not group posts
    };
    if (authorId) {
      where.authorId = authorId;
    }

    const posts = await prisma.post.findMany({
  where,
  orderBy: {
    createdAt: 'desc'
  },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            shares: true
          }
        },
        likes: userId ? {
          where: {
            userId: userId
          },
          select: {
            id: true
          }
        } : false,
        poll: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: {
                _count: { select: { votes: true } }
              }
            }
          }
        }
      }
    });

    // Add isLiked flag and imageUrls for each post
    const postsWithLikeStatus = posts.map(post => {
      const imageUrls = parsePostImages(post.imageUrl);
      return {
        ...post,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        imageUrl: imageUrls[0] || post.imageUrl, // Keep imageUrl for backward compat
        isLiked: userId ? post.likes?.length > 0 : false,
        likes: undefined
      };
    });

    const postsOut = await enrichPollsForPosts(postsWithLikeStatus, userId || null);

    res.status(200).json({ posts: postsOut });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'An error occurred while fetching posts' });
  }
});

// Get users who liked a post (must be before GET /api/posts/:postId so /likes is matched)
app.get('/api/posts/:postId/likes', async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required', likers: [] });
    }

    const likes = await prisma.like.findMany({
      where: { postId },
      include: {
        user: {
          include: {
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const likers = likes
      .map((like) => like.user)
      .filter(Boolean)
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        profile: u.profile ? { profilePictureUrl: u.profile.profilePictureUrl } : null
      }));

    res.status(200).json({ likers });

  } catch (error) {
    console.error('Get likers error:', error);
    res.status(500).json({ message: 'An error occurred while fetching likers', likers: [] });
  }
});

// Vote on a poll (single choice per user)
app.post('/api/posts/:postId/poll/vote', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, optionId } = req.body;

    if (!userId || !optionId) {
      return res.status(400).json({ message: 'userId and optionId are required' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        poll: {
          include: {
            options: { select: { id: true } }
          }
        }
      }
    });

    if (!post || post.postType !== 'POLL' || !post.poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    if (post.poll.expiresAt && new Date(post.poll.expiresAt) <= new Date()) {
      return res.status(400).json({ message: 'This poll has ended' });
    }

    const validOption = post.poll.options.some((o) => o.id === optionId);
    if (!validOption) {
      return res.status(400).json({ message: 'Invalid option' });
    }

    try {
      await prisma.pollVote.create({
        data: {
          pollId: post.poll.id,
          optionId,
          userId
        }
      });
    } catch (e) {
      if (e.code === 'P2002') {
        return res.status(400).json({ message: 'You have already voted on this poll' });
      }
      throw e;
    }

    const fullPoll = await prisma.poll.findUnique({
      where: { id: post.poll.id },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } }
        }
      }
    });

    const [enriched] = await enrichPollsForPosts([{ ...post, poll: fullPoll }], userId);
    res.status(200).json({ message: 'Vote recorded', poll: enriched.poll });
  } catch (error) {
    console.error('Poll vote error:', error);
    res.status(500).json({ message: 'An error occurred while recording your vote' });
  }
});

// Get single post
app.get('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.query.userId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            likes: true,
            shares: true
          }
        },
        poll: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: {
                _count: { select: { votes: true } }
              }
            }
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const imageUrls = parsePostImages(post.imageUrl);
    let postWithImages = {
      ...post,
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      imageUrl: imageUrls[0] || post.imageUrl
    };

    const [out] = await enrichPollsForPosts([postWithImages], viewerId || null);
    postWithImages = out;

    res.status(200).json({ post: postWithImages });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the post' });
  }
});

// Delete a post
app.delete('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await prisma.post.delete({
      where: { id: postId }
    });

    res.status(200).json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the post' });
  }
});

// Update a post (author only)
app.put('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, title, content, imageUrl, imageUrls } = req.body;

    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    if (post.postType === 'POLL') {
      return res.status(400).json({ message: 'Poll posts cannot be edited' });
    }

    let storedImageUrl = post.imageUrl;
    if (imageUrls !== undefined) {
      storedImageUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;
    } else if (imageUrl !== undefined) {
      storedImageUrl = imageUrl || null;
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (storedImageUrl !== undefined) updateData.imageUrl = storedImageUrl;

    const updated = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            shares: true
          }
        }
      }
    });

    const imageUrlsArr = parsePostImages(updated.imageUrl);
    const likeCheck = userId ? await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } }
    }) : null;
    const postWithImages = {
      ...updated,
      imageUrls: imageUrlsArr.length > 0 ? imageUrlsArr : null,
      imageUrl: imageUrlsArr[0] || updated.imageUrl,
      isLiked: !!likeCheck
    };

    res.status(200).json({ message: 'Post updated successfully', post: postWithImages });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'An error occurred while updating the post' });
  }
});

// ==================== LIKE ENDPOINTS ====================

// Like a post
app.post('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user already liked the post
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    if (existingLike) {
      return res.status(400).json({ message: 'Post already liked' });
    }

    // Create like
    const like = await prisma.like.create({
      data: {
        postId,
        userId
      }
    });

    // Create notification for post author (don't notify if they liked their own post)
    if (post.authorId !== userId && await shouldNotify(post.authorId, 'like')) {
      await prisma.notification.create({
        data: {
          recipientId: post.authorId,
          actorId: userId,
          type: 'like',
          postId
        }
      });
    }

    // Get updated like count
    const likeCount = await prisma.like.count({
      where: { postId }
    });

    res.status(201).json({
      message: 'Post liked successfully',
      like,
      likeCount
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'An error occurred while liking the post' });
  }
});

// Unlike a post
app.delete('/api/posts/:postId/unlike', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if like exists
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    if (!existingLike) {
      return res.status(404).json({ message: 'Like not found' });
    }

    // Delete like
    await prisma.like.delete({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    // Get updated like count
    const likeCount = await prisma.like.count({
      where: { postId }
    });

    res.status(200).json({
      message: 'Post unliked successfully',
      likeCount
    });

  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ message: 'An error occurred while unliking the post' });
  }
});

// Check if user liked a post
app.get('/api/posts/:postId/is-liked/:userId', async (req, res) => {
  try {
    const { postId, userId } = req.params;

    const like = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    res.status(200).json({ isLiked: !!like });

  } catch (error) {
    console.error('Check like error:', error);
    res.status(500).json({ message: 'An error occurred while checking like status' });
  }
});

// ==================== COMMENT ENDPOINTS ====================

// Add a comment to a post
app.post('/api/posts/:postId/comment', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, content, mentionedUserIds } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ message: 'User ID and content are required' });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId: userId
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    if (post.authorId !== userId && await shouldNotify(post.authorId, 'comment')) {
  await prisma.notification.create({
    data: {
      recipientId: post.authorId,
      actorId: userId,
      type: 'comment',
      postId
    }
  });
}

const mentionedIds = Array.isArray(mentionedUserIds) ? [...new Set(mentionedUserIds)].filter(Boolean) : [];
for (const mentionedId of mentionedIds) {
  if (mentionedId === userId) continue;
  if (mentionedId === post.authorId) continue;
  if (await shouldNotify(mentionedId, 'mention')) {
    await prisma.notification.create({
      data: {
        recipientId: mentionedId,
        actorId: userId,
        type: 'mention',
        postId
      }
    });
  }
}

    // Get updated comment count
    const commentCount = await prisma.comment.count({
      where: { postId }
    });

    res.status(201).json({
      message: 'Comment added successfully',
      comment,
      commentCount
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'An error occurred while adding the comment' });
  }
});

// Get comments for a post (top-level only, with nested replies)
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profile: {
                      select: {
                        profilePictureUrl: true
                      }
                    }
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ comments });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'An error occurred while fetching comments' });
  }
});

// Reply to a comment
app.post('/api/comments/:commentId/reply', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, content, mentionedUserIds } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ message: 'User ID and content are required' });
    }

    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!parentComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = await prisma.comment.create({
      data: {
        content,
        postId: parentComment.postId,
        authorId: userId,
        parentId: commentId
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    if (parentComment.authorId !== userId && await shouldNotify(parentComment.authorId, 'reply')) {
  await prisma.notification.create({
    data: {
      recipientId: parentComment.authorId,
      actorId: userId,
      type: 'reply',
      postId: parentComment.postId,
      commentId
    }
  });
}

const mentionedIds = Array.isArray(mentionedUserIds) ? [...new Set(mentionedUserIds)].filter(Boolean) : [];
for (const mentionedId of mentionedIds) {
  if (mentionedId === userId) continue;
  if (mentionedId === parentComment.authorId) continue;
  if (await shouldNotify(mentionedId, 'mention')) {
    await prisma.notification.create({
      data: {
        recipientId: mentionedId,
        actorId: userId,
        type: 'mention',
        postId: parentComment.postId,
        commentId
      }
    });
  }
}

    res.status(201).json({
      message: 'Reply added successfully',
      reply
    });

  } catch (error) {
    console.error('Reply to comment error:', error);
    res.status(500).json({ message: 'An error occurred while adding the reply' });
  }
});

// Delete a comment
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.authorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await prisma.comment.delete({
      where: { id: commentId }
    });

    res.status(200).json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the comment' });
  }
});

// Edit a comment
app.put('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, content } = req.body;

    if (!userId || !content?.trim()) {
      return res.status(400).json({ message: 'User ID and content are required' });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.authorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        updatedAt: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePictureUrl: true } }
          }
        }
      }
    });

    res.status(200).json({ message: 'Comment updated successfully', comment: updated });
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ message: 'An error occurred while editing the comment' });
  }
});

// ==================== SHARE ENDPOINTS ====================

// Share a post
app.post('/api/posts/:postId/share', async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create share
    const share = await prisma.share.create({
      data: {
        postId,
        userId
      }
    });

    // Get updated share count
    const shareCount = await prisma.share.count({
      where: { postId }
    });

    res.status(201).json({
      message: 'Post shared successfully',
      share,
      shareCount
    });

  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({ message: 'An error occurred while sharing the post' });
  }
});

// Get share count for a post
app.get('/api/posts/:postId/shares', async (req, res) => {
  try {
    const { postId } = req.params;

    const shareCount = await prisma.share.count({
      where: { postId }
    });

    res.status(200).json({ shareCount });

  } catch (error) {
    console.error('Get shares error:', error);
    res.status(500).json({ message: 'An error occurred while fetching share count' });
  }
});

// ==================== FRIENDSHIP ENDPOINTS ====================

// Send friend request
app.post('/api/friends/request', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'Sender and receiver IDs are required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      }
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'PENDING') {
        return res.status(400).json({ message: 'Friend request already sent' });
      }
      if (existingFriendship.status === 'ACCEPTED') {
        return res.status(400).json({ message: 'Already friends' });
      }
    }

    // Create friend request
    const friendship = await prisma.friendship.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Friend request sent successfully',
      friendship
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'An error occurred while sending friend request' });
  }
});

// Accept friend request
app.put('/api/friends/accept/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Only receiver can accept
    if (friendship.receiverId !== userId) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (friendship.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update to accepted
    const updatedFriendship = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      message: 'Friend request accepted',
      friendship: updatedFriendship
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'An error occurred while accepting friend request' });
  }
});

// Reject/Cancel friend request
app.delete('/api/friends/reject/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Only sender or receiver can reject/cancel
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId }
    });

    res.status(200).json({ message: 'Friend request removed' });

  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ message: 'An error occurred while rejecting friend request' });
  }
});

// Remove friend (unfriend)
app.delete('/api/friends/remove/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found' });
    }

    // Only sender or receiver can remove
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId }
    });

    res.status(200).json({ message: 'Friend removed successfully' });

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'An error occurred while removing friend' });
  }
});

// Get pending friend requests for a user
app.get('/api/friends/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const requests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profile: {
              select: {
                profilePictureUrl: true,
                bio: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ requests });

  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'An error occurred while fetching friend requests' });
  }
});

// Get friends list for a user
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true,
                bio: true
              }
            }
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true,
                bio: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map to get the other user (friend)
    const friends = friendships.map(friendship => {
      const friend = friendship.senderId === userId ? friendship.receiver : friendship.sender;
      return {
        friendshipId: friendship.id,
        ...friend
      };
    });

    res.status(200).json({ friends });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'An error occurred while fetching friends' });
  }
});

// Check friendship status between two users
app.get('/api/friends/status/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(200).json({ 
        status: 'NONE',
        friendshipId: null,
        isSender: false
      });
    }

    res.status(200).json({ 
      status: friendship.status,
      friendshipId: friendship.id,
      isSender: friendship.senderId === userId
    });

  } catch (error) {
    console.error('Check friendship status error:', error);
    res.status(500).json({ message: 'An error occurred while checking friendship status' });
  }
});

// ==================== BLOCK ENDPOINTS ====================

// Block a user
app.post('/api/block/:userId', async (req, res) => {
  try {
    const { userId } = req.params; // User to block
    const { blockerId } = req.body; // Current user doing the blocking

    if (!blockerId) {
      return res.status(400).json({ message: 'Blocker ID is required' });
    }

    if (blockerId === userId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    // Check if already blocked
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: userId
        }
      }
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    // Create block
    const block = await prisma.block.create({
      data: {
        blockerId,
        blockedId: userId
      }
    });

    // Remove any existing friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { senderId: blockerId, receiverId: userId },
          { senderId: userId, receiverId: blockerId }
        ]
      }
    });

    res.status(201).json({
      message: 'User blocked successfully',
      block
    });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'An error occurred while blocking user' });
  }
});

// Unblock a user
app.delete('/api/unblock/:userId', async (req, res) => {
  try {
    const { userId } = req.params; // User to unblock
    const { blockerId } = req.body; // Current user doing the unblocking

    if (!blockerId) {
      return res.status(400).json({ message: 'Blocker ID is required' });
    }

    // Find and delete block
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: userId
        }
      }
    });

    if (!existingBlock) {
      return res.status(404).json({ message: 'Block not found' });
    }

    await prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: userId
        }
      }
    });

    res.status(200).json({ message: 'User unblocked successfully' });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'An error occurred while unblocking user' });
  }
});

// Get list of blocked users
app.get('/api/blocked/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const blocks = await prisma.block.findMany({
      where: {
        blockerId: userId
      },
      include: {
        blocked: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profile: {
              select: {
                profilePictureUrl: true,
                bio: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const blockedUsers = blocks.map(block => ({
      blockId: block.id,
      ...block.blocked
    }));

    res.status(200).json({ blockedUsers });

  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'An error occurred while fetching blocked users' });
  }
});

// Check if user is blocked
app.get('/api/block-status/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    // Check if userId has blocked otherUserId
    const isBlocked = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: otherUserId
        }
      }
    });

    // Check if otherUserId has blocked userId (you're blocked by them)
    const isBlockedBy = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: otherUserId,
          blockedId: userId
        }
      }
    });

    res.status(200).json({ 
      isBlocked: !!isBlocked,
      isBlockedBy: !!isBlockedBy
    });

  } catch (error) {
    console.error('Check block status error:', error);
    res.status(500).json({ message: 'An error occurred while checking block status' });
  }
});



// ==================== SETTINGS ENDPOINTS ====================

// Update Password
app.put('/api/settings/password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (/\s/.test(newPassword)) {
      return res.status(400).json({ message: 'Password cannot contain spaces' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    console.log(`Password updated for user: ${user.email}`);

// Send security alert email
await sendPasswordChangedEmail(user.email, user.firstName);

// Create in-app notification
await prisma.notification.create({
  data: {
    recipientId: userId,
    actorId: userId,
    type: 'security_alert',
    read: false
  }
});

res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'An error occurred while updating password' });
  }
});

app.get('/api/settings/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    if (!preferences) {
      return res.status(200).json({
        preferences: {
          muteAll:            false,
          emailNotifications: true,
          pushNotifications:  true,
          postLikes:          true,
          comments:           true,
          mentions:           true,
          commentReplies:     true,
          groupJoinRequests:  true,
          groupJoinResponse:  true,
          groupNewPost:       true,
          lostFoundNew:       false,
          lostFoundContact:   true,
          lostFoundResolved:  true,
          newFollowers:       true,
        }
      });
    }

    res.status(200).json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'An error occurred while fetching preferences' });
  }
});

app.put('/api/settings/notifications', async (req, res) => {
  try {
    const {
      userId,
      muteAll,
      emailNotifications,
      pushNotifications,
      postLikes,
      comments,
      mentions,
      commentReplies,
      groupJoinRequests,
      groupJoinResponse,
      groupNewPost,
      lostFoundNew,
      lostFoundContact,
      lostFoundResolved,
      newFollowers
    } = req.body;

    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const data = {
      muteAll:            muteAll            ?? false,
      emailNotifications: emailNotifications ?? true,
      pushNotifications:  pushNotifications  ?? true,
      postLikes:          postLikes          ?? true,
      comments:           comments           ?? true,
      mentions:           mentions           ?? true,
      commentReplies:     commentReplies     ?? true,
      groupJoinRequests:  groupJoinRequests  ?? true,
      groupJoinResponse:  groupJoinResponse  ?? true,
      groupNewPost:       groupNewPost       ?? true,
      lostFoundNew:       lostFoundNew       ?? false,
      lostFoundContact:   lostFoundContact   ?? true,
      lostFoundResolved:  lostFoundResolved  ?? true,
      newFollowers:       newFollowers       ?? true,
    };

    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    });

    res.status(200).json({
      message: 'Notification preferences updated successfully',
      preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'An error occurred while updating preferences' });
  }
});

// Temporarily mute notifications
app.post('/api/settings/notifications/mute', async (req, res) => {
  try {
    const { userId, hours } = req.body;

    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    // hours = 0 means unmute immediately
    const muteUntil = hours > 0
      ? new Date(Date.now() + hours * 60 * 60 * 1000)
      : null;

    await prisma.notificationPreferences.upsert({
      where: { userId },
      update: { muteUntil },
      create: { userId, muteUntil }
    });

    const message = hours > 0
      ? `Notifications muted for ${hours} hour${hours === 1 ? '' : 's'}`
      : 'Notifications unmuted';

    res.status(200).json({ message, muteUntil });
  } catch (error) {
    console.error('Mute notifications error:', error);
    res.status(500).json({ message: 'An error occurred while updating mute settings' });
  }
});
// ==================== NOTIFICATIONS ====================

// Get unread notifications count for a user (must be before /:userId so path is matched correctly)
app.get('/api/notifications/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: userId,
        OR: [
          { read: false },
          { read: null }
        ]
      }
    });
    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('Get unread notifications count error:', error);
    res.status(500).json({ message: 'An error occurred while fetching unread notifications count' });
  }
});

function notificationMessageForType(type) {
  switch (type) {
    case 'like': return 'liked your post';
    case 'comment': return 'commented on your post';
    case 'mention': return 'mentioned you in a comment';
    case 'reply': return 'replied to your comment';
    case 'marketplace_listing': return 'listed a new item for sale';
    case 'lostfound_listing': return 'posted a new lost & found item';
    case 'lostfound_resolved': return 'marked a lost & found item as resolved';
    case 'group_join_request': return 'requested to join your group';
    case 'group_join_approved': return 'approved your request to join the group';
    case 'group_join_denied': return 'denied your request to join the group';
    case 'direct_message': return 'sent you a message';
    case 'group_message': return 'sent a message in the group';
    case 'group_chat_mention': return 'tagged you in a group chat';
    case 'group_new_post': return 'posted in a group you belong to';
    case 'group_announcement': return 'posted an announcement in your group';
    case 'group_event': return 'posted an event in your group';
    case 'security_alert': return 'Your password was changed. If this wasn\'t you, reset your password immediately.';
    case 'report_update': return 'Your report has been reviewed by the BuffBuzz admin team.';
    case 'account_warning': return '⚠️ Warning: Your account or content was flagged for violating community guidelines.';
    case 'platform_announcement': return 'sent a platform-wide announcement';
    case 'newsletter_post': return 'published a new post in their newsletter';
    default: return 'sent you an update';
  }
}

// Get notifications for a user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = notifications.map(n => ({
      id: n.id,
      type: n.type,
      read: n.read,
      postId: n.postId,
      commentId: n.commentId,
      marketplaceItemId: n.marketplaceItemId,
      lostFoundItemId: n.lostFoundItemId,
      groupId: n.groupId,
      groupJoinRequestId: n.groupJoinRequestId,
      conversationId: n.conversationId,
      createdAt: n.createdAt,
      userName: `${n.actor.firstName} ${n.actor.lastName}`,
      message: notificationMessageForType(n.type),
    }));

    res.status(200).json({ notifications: formatted });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'An error occurred while fetching notifications' });
  }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true }
    });

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

// Mark all notifications as read
app.put('/api/notifications/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.notification.updateMany({
      where: { recipientId: userId },
      data: { read: true }
    });

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

// Delete a notification
app.delete('/api/notifications/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

// Delete Account
app.delete('/api/settings/delete-account', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ message: 'User ID and password are required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password before deletion
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Delete user (will cascade delete all related data)
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`Account deleted for user: ${user.email}`);

    res.status(200).json({ 
      message: 'Account deleted successfully. All your data has been removed.' 
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'An error occurred while deleting account' });
  }
});

// ==================== JOB ENDPOINTS ====================

// Create a job posting
app.post('/api/jobs/create', async (req, res) => {
  try {
    const {
      title,
      company,
      location,
      jobType,
      category,
      description,
      requirements,
      salary,
      applicationLink,
      applicationDeadline,
      posterId
    } = req.body;

    if (!title || !company || !location || !jobType || !category || !description || !requirements || !applicationLink || !posterId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const job = await prisma.job.create({
      data: {
        title,
        company,
        location,
        jobType,
        category,
        description,
        requirements,
        salary: salary || null,
        applicationLink,
        applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
        posterId
      },
      include: {
        poster: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Job posted successfully',
      job
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'An error occurred while posting the job' });
  }
});

// Get all jobs with optional filtering
app.get('/api/jobs', async (req, res) => {
  try {
    const { category, search } = req.query;

    const whereClause = category && category !== 'ALL_JOBS' ? { category } : {};
    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { company: { contains: search.trim(), mode: 'insensitive' } },
        { location: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        poster: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({ jobs });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'An error occurred while fetching jobs' });
  }
});

// Get single job
app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        poster: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.status(200).json({ job });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the job' });
  }
});

// Delete a job
app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.posterId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await prisma.job.delete({
      where: { id: jobId }
    });

    res.status(200).json({ message: 'Job deleted successfully' });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the job' });
  }
});

// Update a job posting (poster only)
app.put('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, title, company, location, jobType, category, description, requirements, salary, applicationLink, applicationDeadline } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.posterId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this job' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (company !== undefined) updateData.company = company;
    if (location !== undefined) updateData.location = location;
    if (jobType !== undefined) updateData.jobType = jobType;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (salary !== undefined) updateData.salary = salary || null;
    if (applicationLink !== undefined) updateData.applicationLink = applicationLink;
    if (applicationDeadline !== undefined) updateData.applicationDeadline = applicationDeadline ? new Date(applicationDeadline) : null;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        poster: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(200).json({ message: 'Job updated successfully', job: updated });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'An error occurred while updating the job' });
  }
});

// ==================== MARKETPLACE ENDPOINTS ====================

const MAX_LISTING_IMAGES = 5;

// Normalize stored imageUrl (string or JSON array) to imageUrls array for API responses
function getImageUrlsFromItem(item) {
  if (!item || item.imageUrl == null || item.imageUrl === '') return [];
  const v = item.imageUrl;
  if (typeof v !== 'string') return [];
  const trimmed = v.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr)) return [v];
      return arr.filter(Boolean);
    } catch (_) {
      return [v];
    }
  }
  return [v];
}

// Create a marketplace listing
app.post('/api/marketplace/create', async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      imageUrl,
      imageUrls,
      sellerId
    } = req.body;

    if (!title || !description || !price || !category || !condition || !sellerId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    let urls = Array.isArray(imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : []);
    urls = urls.filter(Boolean).slice(0, MAX_LISTING_IMAGES);
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    for (const url of urls) {
      const dataUrlMatch = url.match(/^data:(image\/[a-zA-Z]+);base64,/);
      if (!dataUrlMatch || !allowedImageTypes.includes(dataUrlMatch[1])) {
        return res.status(400).json({ message: 'Only image files are accepted (JPEG, PNG, GIF, WebP)' });
      }
    }
    const imageUrlStorage = urls.length > 0 ? JSON.stringify(urls) : null;

    const item = await prisma.marketplaceItem.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        category,
        condition,
        imageUrl: imageUrlStorage,
        sellerId
      },
      include: {
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Notify all users except the seller about the new listing
    const otherUsers = await prisma.user.findMany({
      where: { id: { not: sellerId } },
      select: { id: true }
    });
    if (otherUsers.length > 0) {
      await prisma.notification.createMany({
        data: otherUsers.map(u => ({
          recipientId: u.id,
          actorId: sellerId,
          type: 'marketplace_listing',
          marketplaceItemId: item.id
        }))
      });
    }

    const itemWithUrls = { ...item, imageUrls: getImageUrlsFromItem(item) };
    res.status(201).json({
      message: 'Item listed successfully',
      item: itemWithUrls
    });

  } catch (error) {
    console.error('Create marketplace item error:', error);
    res.status(500).json({ message: 'An error occurred while listing the item' });
  }
});

// Get all marketplace items with optional filtering
app.get('/api/marketplace', async (req, res) => {
  try {
    const { category, search } = req.query;

    const whereClause = category && category !== 'all' ? { category } : {};
    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const items = await prisma.marketplaceItem.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    // Format items with seller name and imageUrls array
    const formattedItems = items.map(item => ({
      ...item,
      sellerName: `${item.seller.firstName} ${item.seller.lastName}`,
      imageUrls: getImageUrlsFromItem(item)
    }));

    res.status(200).json({ items: formattedItems });

  } catch (error) {
    console.error('Get marketplace items error:', error);
    res.status(500).json({ message: 'An error occurred while fetching items' });
  }
});

// Get single marketplace item
app.get('/api/marketplace/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.marketplaceItem.findUnique({
      where: { id: itemId },
      include: {
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemWithUrls = { ...item, imageUrls: getImageUrlsFromItem(item) };
    res.status(200).json({ item: itemWithUrls });

  } catch (error) {
    console.error('Get marketplace item error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the item' });
  }
});

// Delete a marketplace item
app.delete('/api/marketplace/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId } = req.body;

    const item = await prisma.marketplaceItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.sellerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await prisma.marketplaceItem.delete({
      where: { id: itemId }
    });

    res.status(200).json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Delete marketplace item error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the item' });
  }
});

// Update a marketplace item (owner only)
app.put('/api/marketplace/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId, title, description, price, category, condition, imageUrl, imageUrls } = req.body;

    const item = await prisma.marketplaceItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.sellerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this item' });
    }

    let storedImageUrl = item.imageUrl;
    if (Array.isArray(imageUrls)) {
      const urls = imageUrls.filter(Boolean).slice(0, MAX_LISTING_IMAGES);
      storedImageUrl = urls.length > 0 ? JSON.stringify(urls) : null;
    } else if (imageUrl !== undefined) {
      storedImageUrl = imageUrl || null;
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category !== undefined) updateData.category = category;
    if (condition !== undefined) updateData.condition = condition;
    if (storedImageUrl !== undefined) updateData.imageUrl = storedImageUrl;

    const updated = await prisma.marketplaceItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const itemWithUrls = { ...updated, imageUrls: getImageUrlsFromItem(updated) };
    res.status(200).json({ message: 'Item updated successfully', item: itemWithUrls });

  } catch (error) {
    console.error('Update marketplace item error:', error);
    res.status(500).json({ message: 'An error occurred while updating the item' });
  }
});

// ==================== LOST & FOUND ENDPOINTS ====================

// Create a lost/found item
app.post('/api/lostfound/create', async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      date,
      contactInfo,
      imageUrl,
      imageUrls,
      userId
    } = req.body;

    if (!title || !description || !category || !location || !date || !contactInfo || !userId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    let urls = Array.isArray(imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : []);
    urls = urls.filter(Boolean).slice(0, MAX_LISTING_IMAGES);
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    for (const url of urls) {
      const dataUrlMatch = url.match(/^data:(image\/[a-zA-Z]+);base64,/);
      if (!dataUrlMatch || !allowedImageTypes.includes(dataUrlMatch[1])) {
        return res.status(400).json({ message: 'Only image files are accepted (JPEG, PNG, GIF, WebP)' });
      }
    }
    const imageUrlStorage = urls.length > 0 ? JSON.stringify(urls) : null;

    const item = await prisma.lostFoundItem.create({
      data: {
        title,
        description,
        category,
        location,
        date: new Date(date),
        contactInfo,
        imageUrl: imageUrlStorage,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Notify all users except the poster about the new lost & found listing
    const otherUsers = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true }
    });
    if (otherUsers.length > 0) {
      await prisma.notification.createMany({
        data: otherUsers.map(u => ({
          recipientId: u.id,
          actorId: userId,
          type: 'lostfound_listing',
          lostFoundItemId: item.id
        }))
      });
    }

    const itemWithUrls = { ...item, imageUrls: getImageUrlsFromItem(item) };
    res.status(201).json({
      message: 'Item posted successfully',
      item: itemWithUrls
    });

  } catch (error) {
    console.error('Create lost/found item error:', error);
    res.status(500).json({ message: 'An error occurred while posting the item' });
  }
});

// Get all lost/found items with optional filtering
app.get('/api/lostfound', async (req, res) => {
  try {
    const { category, search } = req.query;

    const whereClause = category && category !== 'all' ? { category } : {};
    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { location: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const items = await prisma.lostFoundItem.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    // Format items with user name and imageUrls array
    const formattedItems = items.map(item => ({
      ...item,
      userName: `${item.user.firstName} ${item.user.lastName}`,
      imageUrls: getImageUrlsFromItem(item)
    }));

    res.status(200).json({ items: formattedItems });

  } catch (error) {
    console.error('Get lost/found items error:', error);
    res.status(500).json({ message: 'An error occurred while fetching items' });
  }
});

// Get single lost/found item
app.get('/api/lostfound/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.lostFoundItem.findUnique({
      where: { id: itemId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemWithUrls = { ...item, imageUrls: getImageUrlsFromItem(item) };
    res.status(200).json({ item: itemWithUrls });

  } catch (error) {
    console.error('Get lost/found item error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the item' });
  }
});

// Delete a lost/found item
app.delete('/api/lostfound/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId } = req.body;

    const item = await prisma.lostFoundItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await prisma.lostFoundItem.delete({
      where: { id: itemId }
    });

    res.status(200).json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Delete lost/found item error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the item' });
  }
});

// Update a lost/found item (owner only)
app.put('/api/lostfound/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId, title, description, category, location, date, contactInfo, imageUrl, imageUrls, resolved } = req.body;

    const item = await prisma.lostFoundItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this item' });
    }

    let storedImageUrl = item.imageUrl;
    if (Array.isArray(imageUrls)) {
      const urls = imageUrls.filter(Boolean).slice(0, MAX_LISTING_IMAGES);
      storedImageUrl = urls.length > 0 ? JSON.stringify(urls) : null;
    } else if (imageUrl !== undefined) {
      storedImageUrl = imageUrl || null;
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (location !== undefined) updateData.location = location;
    if (date !== undefined) updateData.date = new Date(date);
    if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
    if (storedImageUrl !== undefined) updateData.imageUrl = storedImageUrl;
    if (resolved !== undefined) updateData.resolved = Boolean(resolved);

    const wasResolved = item.resolved === true;
    const willBecomeResolved = resolved !== undefined && Boolean(resolved) === true;

    const updated = await prisma.lostFoundItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (willBecomeResolved && !wasResolved) {
      const listingRecipients = await prisma.notification.findMany({
        where: {
          lostFoundItemId: itemId,
          type: 'lostfound_listing'
        },
        select: { recipientId: true }
      });
      const uniqueRecipientIds = [...new Set(listingRecipients.map(r => r.recipientId))].filter(id => id !== userId);
      const notifyRecipientIds = (await Promise.all(
        uniqueRecipientIds.map(async (recipientId) => {
          const ok = await shouldNotify(recipientId, 'lostfound_resolved');
          return ok ? recipientId : null;
        })
      )).filter(Boolean);

      if (notifyRecipientIds.length > 0) {
        await prisma.notification.createMany({
          data: notifyRecipientIds.map(recipientId => ({
            recipientId,
            actorId: userId,
            type: 'lostfound_resolved',
            lostFoundItemId: itemId
          }))
        });
      }
    }

    const itemWithUrls = { ...updated, imageUrls: getImageUrlsFromItem(updated) };
    res.status(200).json({ message: 'Item updated successfully', item: itemWithUrls });

  } catch (error) {
    console.error('Update lost/found item error:', error);
    res.status(500).json({ message: 'An error occurred while updating the item' });
  }
});

// ==================== GROUP ENDPOINTS ====================

// Create a group
app.post('/api/groups/create', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      privacy,
      imageUrl,
      creatorId
    } = req.body;

    if (!name || !description || !category || !privacy || !creatorId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    if (imageUrl) {
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const dataUrlMatch = imageUrl.match(/^data:(image\/[a-zA-Z]+);base64,/);
      if (!dataUrlMatch || !allowedImageTypes.includes(dataUrlMatch[1])) {
        return res.status(400).json({ message: 'Only image files are accepted (JPEG, PNG, GIF, WebP)' });
      }
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        category,
        privacy,
        imageUrl: imageUrl || null,
        creatorId
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Automatically add creator as admin member
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: creatorId,
        role: 'ADMIN'
      }
    });

    res.status(201).json({
      message: 'Group created successfully',
      group
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'An error occurred while creating the group' });
  }
});

// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};
    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const groups = await prisma.group.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        members: {
          select: {
            userId: true
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    // Format groups with member info
    const formattedGroups = groups.map(group => ({
      ...group,
      memberCount: group._count.members,
      members: group.members.map(m => m.userId)
    }));

    res.status(200).json({ groups: formattedGroups });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'An error occurred while fetching groups' });
  }
});

// Get single group
app.get('/api/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.status(200).json({ group });

  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'An error occurred while fetching the group' });
  }
});

// Get posts for a specific group
app.get('/api/groups/:groupId/posts', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.query;

    const posts = await prisma.post.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: { profilePictureUrl: true }
            }
          }
        },
        _count: {
          select: { comments: true, likes: true, shares: true }
        },
        likes: userId
          ? {
              where: { userId },
              select: { id: true }
            }
          : false,
        poll: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: {
                _count: { select: { votes: true } }
              }
            }
          }
        }
      }
    });

    const mapped = posts.map((post) => {
      const imageUrls = parsePostImages(post.imageUrl);
      return {
        ...post,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        imageUrl: imageUrls[0] || post.imageUrl,
        isLiked: userId ? post.likes?.length > 0 : false,
        likes: undefined
      };
    });

    const out = await enrichPollsForPosts(mapped, userId || null);

    res.status(200).json({ posts: out });
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({ message: 'An error occurred while fetching group posts' });
  }
});

// Join a group
app.post('/api/groups/:groupId/join', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only allow joining public groups instantly
    if (group.privacy === 'PRIVATE') {
      return res.status(400).json({ message: 'Cannot join private groups yet. Approval system coming soon!' });
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    // Add user to group
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'MEMBER'
      }
    });

    res.status(201).json({
      message: 'Successfully joined the group',
      member
    });

  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'An error occurred while joining the group' });
  }
});

// Leave a group
app.delete('/api/groups/:groupId/leave', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(404).json({ message: 'Not a member of this group' });
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    // Reset stale approved request so user can request to rejoin later.
    await prisma.groupJoinRequest.updateMany({
      where: { groupId, userId, status: 'APPROVED' },
      data: { status: 'DENIED' }
    });

    res.status(200).json({ message: 'Successfully left the group' });

  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'An error occurred while leaving the group' });
  }
});

// Request to join a private group (creates pending request + notifies group owner)
app.post('/api/groups/:groupId/request-join', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { creator: { select: { id: true, firstName: true, lastName: true } } }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.privacy !== 'PRIVATE') {
      return res.status(400).json({ message: 'This group is public; use the regular join endpoint' });
    }

    if (group.creatorId === userId) {
      return res.status(400).json({ message: 'You are already the group owner' });
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } }
    });
    if (existingMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    let request = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId, userId } }
    });
    if (request?.status === 'PENDING') {
      return res.status(400).json({ message: 'You already have a pending request for this group' });
    }
    if (request?.status === 'APPROVED') {
      // Safety: if membership was removed but request stayed APPROVED, allow re-request.
      const approvedMember = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } }
      });
      if (approvedMember) {
        return res.status(400).json({ message: 'You are already a member' });
      }
      request = await prisma.groupJoinRequest.update({
        where: { id: request.id },
        data: { status: 'PENDING' }
      });
    }

    if (request && request.status === 'DENIED') {
      request = await prisma.groupJoinRequest.update({
        where: { id: request.id },
        data: { status: 'PENDING' }
      });
    } else {
      request = await prisma.groupJoinRequest.create({
        data: { groupId, userId, status: 'PENDING' }
      });
    }

    if (await shouldNotify(group.creatorId, 'group_join_request')) {
  await prisma.notification.create({
    data: {
      recipientId: group.creatorId,
      actorId: userId,
      type: 'group_join_request',
      groupId,
      groupJoinRequestId: request.id
    }
  });
}

    res.status(201).json({
      message: 'Join request sent. The group owner will be notified.',
      request: { id: request.id, groupId, userId, status: request.status }
    });
  } catch (error) {
    console.error('Request join group error:', error);
    res.status(500).json({ message: 'An error occurred while sending the join request' });
  }
});

// Get pending join requests for a group (group owner only)
app.get('/api/groups/:groupId/join-requests', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.query;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'Only the group owner can view join requests' });
    }

    const requests = await prisma.groupJoinRequest.findMany({
      where: { groupId, status: 'PENDING' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ message: 'An error occurred while fetching join requests' });
  }
});

// Approve a group join request (group owner only)
app.post('/api/groups/:groupId/join-requests/:requestId/approve', async (req, res) => {
  try {
    const { groupId, requestId } = req.params;
    const { userId: ownerId } = req.body;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creatorId !== ownerId) {
      return res.status(403).json({ message: 'Only the group owner can approve requests' });
    }

    const joinRequest = await prisma.groupJoinRequest.findFirst({
      where: { id: requestId, groupId, status: 'PENDING' }
    });
    if (!joinRequest) {
      return res.status(404).json({ message: 'Join request not found or already processed' });
    }

    await prisma.$transaction([
      prisma.groupMember.create({
        data: { groupId, userId: joinRequest.userId, role: 'MEMBER' }
      }),
      prisma.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      })
    ]);

    if (await shouldNotify(joinRequest.userId, 'group_join_approved')) {
  await prisma.notification.create({
    data: {
      recipientId: joinRequest.userId,
      actorId: ownerId,
      type: 'group_join_approved',
      groupId
    }
  });
}

    // Remove the owner's actionable request notification after processing
    await prisma.notification.deleteMany({
      where: {
        recipientId: ownerId,
        type: 'group_join_request',
        groupId,
        groupJoinRequestId: requestId
      }
    });

    res.status(200).json({ message: 'Join request approved' });
  } catch (error) {
    console.error('Approve join request error:', error);
    res.status(500).json({ message: 'An error occurred while approving the request' });
  }
});

// Deny a group join request (group owner only)
app.post('/api/groups/:groupId/join-requests/:requestId/deny', async (req, res) => {
  try {
    const { groupId, requestId } = req.params;
    const { userId: ownerId } = req.body;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creatorId !== ownerId) {
      return res.status(403).json({ message: 'Only the group owner can deny requests' });
    }

    const joinRequest = await prisma.groupJoinRequest.findFirst({
      where: { id: requestId, groupId, status: 'PENDING' }
    });
    if (!joinRequest) {
      return res.status(404).json({ message: 'Join request not found or already processed' });
    }

    await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'DENIED' }
    });

    if (await shouldNotify(joinRequest.userId, 'group_join_denied')) {
  await prisma.notification.create({
    data: {
      recipientId: joinRequest.userId,
      actorId: ownerId,
      type: 'group_join_denied',
      groupId
    }
  });
}

    // Remove the owner's actionable request notification after processing
    await prisma.notification.deleteMany({
      where: {
        recipientId: ownerId,
        type: 'group_join_request',
        groupId,
        groupJoinRequestId: requestId
      }
    });

    res.status(200).json({ message: 'Join request denied' });
  } catch (error) {
    console.error('Deny join request error:', error);
    res.status(500).json({ message: 'An error occurred while denying the request' });
  }
});

// Remove a member from a group (creator/admin only)
app.delete('/api/groups/:groupId/members/:memberId', async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { adminId } = req.body;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Only the creator or an admin member can remove people
    const requester = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: adminId } }
    });
    if (group.creatorId !== adminId && requester?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // Cannot remove the group creator
    if (memberId === group.creatorId) {
      return res.status(400).json({ message: 'Cannot remove the group owner' });
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: memberId } }
    });

    // Reset stale approved request so removed users can request to join again cleanly.
    await prisma.groupJoinRequest.updateMany({
      where: { groupId, userId: memberId, status: 'APPROVED' },
      data: { status: 'DENIED' }
    });

    // Notify the removed member.
    await prisma.notification.create({
      data: {
        recipientId: memberId,
        actorId: adminId,
        type: 'group_member_removed',
        groupId
      }
    });

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'An error occurred while removing the member' });
  }
});

// Change a member's role (creator only)
app.put('/api/groups/:groupId/members/:memberId/role', async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { adminId, role } = req.body;

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ message: 'Role must be ADMIN or MEMBER' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Only the creator can promote/demote
    if (group.creatorId !== adminId) {
      return res.status(403).json({ message: 'Only the group owner can change roles' });
    }

    // Cannot change the creator's own role
    if (memberId === group.creatorId) {
      return res.status(400).json({ message: 'Cannot change the owner\'s role' });
    }

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: memberId } },
      data: { role }
    });

    res.status(200).json({ message: 'Role updated successfully', member: updated });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ message: 'An error occurred while updating the role' });
  }
});
// Delete a group
app.delete('/api/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'Only the group creator can delete this group' });
    }

    await prisma.group.delete({
      where: { id: groupId }
    });

    res.status(200).json({ message: 'Group deleted successfully' });

  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the group' });
  }
});

// Update a group (creator only)
app.put('/api/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, name, description, category, privacy, imageUrl } = req.body;

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'Only the group creator can edit this group' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (privacy !== undefined) updateData.privacy = privacy;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(200).json({ message: 'Group updated successfully', group: updated });

  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'An error occurred while updating the group' });
  }
});

// ==================== MESSAGING ENDPOINTS ====================

// Get or create a conversation between users
app.post('/api/conversations/get-or-create', async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ message: 'Both user IDs are required' });
    }

    // Check if conversation already exists between these two users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroupChat: false,
        participants: {
          every: {
            userId: {
              in: [userId, otherUserId]
            }
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (existingConversation) {
      return res.status(200).json({ conversation: existingConversation });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        isGroupChat: false,
        participants: {
          create: [
            { userId: userId },
            { userId: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            }
          }
        },
        messages: true
      }
    });

    res.status(201).json({ conversation });

  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ message: 'An error occurred while getting conversation' });
  }
});

// Get all conversations for a user
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find(p => p.userId === userId);
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            createdAt: {
              gt: participant?.lastReadAt || new Date(0)
            },
            deletedAt: null
          }
        });

        return {
          ...conv,
          unreadCount
        };
      })
    );

    res.status(200).json({ conversations: conversationsWithUnread });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'An error occurred while fetching conversations' });
  }
});

// Get messages in a conversation
// Get messages in a conversation
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        deletedAt: null
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Get conversation data with participants
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          select: {
            userId: true,
            lastReadAt: true
          }
        }
      }
    });

    res.status(200).json({ 
      messages,
      conversation
    });

  } catch (error) {
    console.error('Get messages error:', error);
    console.error('Error details:', error.message); // ADD THIS LINE
    res.status(500).json({ message: 'An error occurred while fetching messages', error: error.message });
  }
});

// Send a message
app.post('/api/messages/send', async (req, res) => {
  try {
    const { conversationId, senderId, content, type, imageUrl, replyToId } = req.body;

    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ message: 'Conversation ID, sender ID, and content are required' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      }
    });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        type: type || 'TEXT',
        imageUrl: imageUrl || null,
        replyToId: replyToId || null
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    const recipientIds = conversation.participants
  .map(p => p.userId)
  .filter(id => id !== senderId);
const notificationType = conversation.isGroupChat ? 'group_message' : 'direct_message';
for (const recipientId of recipientIds) {
  if (await shouldNotify(recipientId, notificationType)) {
    await prisma.notification.create({
      data: {
        recipientId,
        actorId: senderId,
        type: notificationType,
        conversationId
      }
    });
  }
}

    // If group chat: parse @mentions and create group_chat_mention notifications
    if (conversation.isGroupChat && content && typeof content === 'string') {
      const mentionMatches = content.match(/@([A-Za-z]+(?:\s+[A-Za-z]+)*)/g) || [];
      const mentionNames = [...new Set(mentionMatches.map(m => m.slice(1).trim().toLowerCase()))];
      if (mentionNames.length > 0) {
        for (const p of conversation.participants) {
          if (p.userId === senderId) continue;
          const u = p.user;
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
          const firstOnly = (u.firstName || '').toLowerCase();
          const lastOnly = (u.lastName || '').toLowerCase();
          const matched = mentionNames.some(name => {
            const n = name.trim();
            return fullName === n || firstOnly === n || lastOnly === n ||
              fullName.includes(n) || (n.includes(' ') && fullName.includes(n));
          });
          if (matched && await shouldNotify(p.userId, 'group_chat_mention')) {
  await prisma.notification.create({
    data: {
      recipientId: p.userId,
      actorId: senderId,
      type: 'group_chat_mention',
      conversationId
    }
  });
}
        }
      }
    }

    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json({ message });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'An error occurred while sending message' });
  }
});

// Mark messages as read
app.put('/api/conversations/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId
      },
      data: {
        lastReadAt: new Date()
      }
    });

    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        conversationId,
        type: { in: ['direct_message', 'group_message', 'group_chat_mention'] }
      },
      data: { read: true }
    });

    res.status(200).json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'An error occurred while marking messages as read' });
  }
});

// Delete a message
app.delete('/api/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Soft delete
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() }
    });

    res.status(200).json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'An error occurred while deleting message' });
  }
});

// Create group chat
app.post('/api/conversations/group/create', async (req, res) => {
  try {
    const { creatorId, name, participantIds, imageUrl } = req.body;

    if (!creatorId || !name || !participantIds || participantIds.length === 0) {
      return res.status(400).json({ message: 'Creator ID, name, and participants are required' });
    }

    // Create group chat
    const conversation = await prisma.conversation.create({
      data: {
        isGroupChat: true,
        name,
        imageUrl: imageUrl || null,
        creatorId: creatorId,
        participants: {
          create: [
            { userId: creatorId },
            ...participantIds.map(id => ({ userId: id }))
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            }
          }
        }
      }
    });

    res.status(201).json({ conversation });

  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ message: 'An error occurred while creating group chat' });
  }
});

// Delete a conversation (group chat)
app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Only allow deleting group chats
    if (!conversation.isGroupChat) {
      return res.status(400).json({ message: 'Cannot delete direct conversations' });
    }

    // Check if user is the creator
    if (conversation.creatorId !== userId) {
      return res.status(403).json({ message: 'Only the group creator can delete this group' });
    }

    // Delete the conversation
    await prisma.conversation.delete({
      where: { id: conversationId }
    });

    res.status(200).json({ message: 'Group chat deleted successfully' });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'An error occurred while deleting the conversation' });
  }
});

// Leave a conversation (group chat)
app.post('/api/conversations/:conversationId/leave', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.isGroupChat) {
      return res.status(400).json({ message: 'Cannot leave direct conversations' });
    }

    // Remove user from conversation participants
    await prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId
      }
    });

    res.status(200).json({ message: 'Successfully left the conversation' });

  } catch (error) {
    console.error('Leave conversation error:', error);
    res.status(500).json({ message: 'An error occurred while leaving the conversation' });
  }
});

// Edit a message
app.put('/api/messages/:messageId/edit', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { 
        content,
        editedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({ message: updatedMessage });

  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'An error occurred while editing the message' });
  }
});

// React to a message
app.post('/api/messages/:messageId/react', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;

    if (!userId || !emoji) {
      return res.status(400).json({ message: 'User ID and emoji are required' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      }
    });

    if (existingReaction) {
      // If same emoji, remove reaction
      if (existingReaction.emoji === emoji) {
        await prisma.messageReaction.delete({
          where: {
            messageId_userId: {
              messageId,
              userId
            }
          }
        });
        return res.status(200).json({ message: 'Reaction removed' });
      } else {
        // Update to new emoji
        const reaction = await prisma.messageReaction.update({
          where: {
            messageId_userId: {
              messageId,
              userId
            }
          },
          data: { emoji },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });
        return res.status(200).json({ reaction });
      }
    }

    // Create new reaction
    const reaction = await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({ reaction });

  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ message: 'An error occurred while reacting to the message' });
  }
});

// Get message reactions
app.get('/api/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(200).json({ reactions });

  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ message: 'An error occurred while fetching reactions' });
  }
});

// Get user's friends for group chat creation
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    const friends = friendships.map(friendship => {
      return friendship.senderId === userId ? friendship.receiver : friendship.sender;
    });

    res.status(200).json({ friends });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'An error occurred while fetching friends' });
  }
});

// ==================== REPORTS (admin queue; submitted by users) ====================

const REPORT_TARGET_TYPES = new Set([
  'POST',
  'COMMENT',
  'MARKETPLACE_ITEM',
  'LOST_FOUND_ITEM',
  'GROUP',
  'USER',
  'JOB',
  'MESSAGE',
]);

const REPORT_CATEGORIES = new Set([
  'SPAM',
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'SCAM_OR_FRAUD',
  'IMPERSONATION',
  'OTHER',
]);

async function validateReportTarget(reporterId, targetType, targetId) {
  switch (targetType) {
    case 'USER': {
      if (reporterId === targetId) {
        return { ok: false, message: 'You cannot report your own account' };
      }
      const user = await prisma.user.findUnique({ where: { id: targetId } });
      if (!user) return { ok: false, message: 'User not found' };
      return { ok: true };
    }
    case 'POST': {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (!post) return { ok: false, message: 'Post not found' };
      if (post.authorId === reporterId) {
        return { ok: false, message: 'You cannot report your own post' };
      }
      return { ok: true };
    }
    case 'COMMENT': {
      const comment = await prisma.comment.findUnique({ where: { id: targetId } });
      if (!comment) return { ok: false, message: 'Comment not found' };
      if (comment.authorId === reporterId) {
        return { ok: false, message: 'You cannot report your own comment' };
      }
      return { ok: true };
    }
    case 'MARKETPLACE_ITEM': {
      const listing = await prisma.marketplaceItem.findUnique({ where: { id: targetId } });
      if (!listing) return { ok: false, message: 'Listing not found' };
      if (listing.sellerId === reporterId) {
        return { ok: false, message: 'You cannot report your own listing' };
      }
      return { ok: true };
    }
    case 'LOST_FOUND_ITEM': {
      const entry = await prisma.lostFoundItem.findUnique({ where: { id: targetId } });
      if (!entry) return { ok: false, message: 'Item not found' };
      if (entry.userId === reporterId) {
        return { ok: false, message: 'You cannot report your own lost & found entry' };
      }
      return { ok: true };
    }
    case 'GROUP': {
      const group = await prisma.group.findUnique({ where: { id: targetId } });
      if (!group) return { ok: false, message: 'Group not found' };
      return { ok: true };
    }
    case 'JOB': {
      const job = await prisma.job.findUnique({ where: { id: targetId } });
      if (!job) return { ok: false, message: 'Job not found' };
      if (job.posterId === reporterId) {
        return { ok: false, message: 'You cannot report your own job posting' };
      }
      return { ok: true };
    }
    case 'MESSAGE': {
      const message = await prisma.message.findUnique({ where: { id: targetId } });
      if (!message) return { ok: false, message: 'Message not found' };
      if (message.senderId === reporterId) {
        return { ok: false, message: 'You cannot report your own message' };
      }
      return { ok: true };
    }
    default:
      return { ok: false, message: 'Invalid report target type' };
  }
}

app.post('/api/reports', async (req, res) => {
  try {
    const { reporterId, targetType, targetId, category, details } = req.body;

    if (!reporterId || !targetType || !targetId) {
      return res.status(400).json({ message: 'reporterId, targetType, and targetId are required' });
    }

    if (!REPORT_TARGET_TYPES.has(targetType)) {
      return res.status(400).json({ message: 'Invalid targetType' });
    }

    const reporter = await prisma.user.findUnique({ where: { id: reporterId } });
    if (!reporter) {
      return res.status(404).json({ message: 'Reporter not found' });
    }

    const reportCategory = category && REPORT_CATEGORIES.has(category) ? category : 'OTHER';

    const detailsStr =
      typeof details === 'string' ? details.trim().slice(0, 2000) : '';
    if (typeof details === 'string' && details.length > 2000) {
      return res.status(400).json({ message: 'Details must be 2000 characters or less' });
    }

    const check = await validateReportTarget(reporterId, targetType, targetId);
    if (!check.ok) {
      return res.status(400).json({ message: check.message });
    }

    try {
      const report = await prisma.report.create({
        data: {
          reporterId,
          targetType,
          targetId,
          category: reportCategory,
          details: detailsStr || null,
        },
      });
      return res.status(201).json({
        message: 'Report submitted. Our team will review it.',
        report,
      });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ message: 'You have already reported this' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ message: 'An error occurred while submitting the report' });
  }
});
// GET /api/users/recommendations/:userId
app.get('/api/users/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 6;

    // Get IDs to exclude: self, existing friends/pending, blocked
    const [friendships, blocks, profile] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        select: { senderId: true, receiverId: true }
      }),
      prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true }
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: { major: true, department: true }
      })
    ]);

    const excludedIds = new Set([userId]);
    friendships.forEach(f => {
      excludedIds.add(f.senderId);
      excludedIds.add(f.receiverId);
    });
    blocks.forEach(b => {
      excludedIds.add(b.blockerId);
      excludedIds.add(b.blockedId);
    });

    // Get friends-of-friends for prioritization
    const friendIds = friendships.map(f =>
      f.senderId === userId ? f.receiverId : f.senderId
    );

    const friendsOfFriends = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: { in: friendIds }, status: 'ACCEPTED' },
          { receiverId: { in: friendIds }, status: 'ACCEPTED' }
        ]
      },
      select: { senderId: true, receiverId: true }
    });

    const fofIds = new Set();
    friendsOfFriends.forEach(f => {
      if (!excludedIds.has(f.senderId)) fofIds.add(f.senderId);
      if (!excludedIds.has(f.receiverId)) fofIds.add(f.receiverId);
    });

    // Fetch candidate users
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [...excludedIds] },
        verificationStatus: 'VERIFIED',
        suspended: false
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userType: true,
        profile: {
          select: {
            profilePictureUrl: true,
            major: true,
            department: true,
            bio: true
          }
        }
      },
      take: 50
    });

    // Score each candidate
    const scored = candidates.map(u => {
      let score = 0;
      if (fofIds.has(u.id)) score += 3;
      if (profile?.major && u.profile?.major === profile.major) score += 2;
      if (profile?.department && u.profile?.department === profile.department) score += 1;
      return { ...u, score };
    });

    // Sort by score desc, then shuffle within same score for variety
    scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

    const recommendations = scored.slice(0, limit).map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      userType: u.userType,
      profilePictureUrl: u.profile?.profilePictureUrl || null,
      major: u.profile?.major || null,
      department: u.profile?.department || null,
      bio: u.profile?.bio || null,
      score: u.score,
      mutualFriends: fofIds.has(u.id)
    }));

    res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

// ==================== NEWSLETTERS & PLATFORM ANNOUNCEMENTS ====================

async function assertNewsletterAdminUser(adminUserId) {
  if (!adminUserId) return null;
  const u = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!u) return null;
  const adminEmail = (process.env.ADMIN_EMAIL || 'buffbuzz@wtamu.edu').trim().toLowerCase();
  if (normalizeEmail(u.email) !== adminEmail) return null;
  return u;
}

app.get('/api/announcements', async (req, res) => {
  try {
    const announcements = await prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    res.status(200).json({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Failed to load announcements' });
  }
});

app.post('/api/admin/announcements', async (req, res) => {
  try {
    const { adminUserId, title, content } = req.body;
    if (!adminUserId || !String(title || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ message: 'adminUserId, title, and content are required' });
    }
    const admin = await assertNewsletterAdminUser(adminUserId);
    if (!admin) return res.status(403).json({ message: 'Admin access required' });

    const announcement = await prisma.platformAnnouncement.create({
      data: {
        title: String(title).trim(),
        content: String(content).trim(),
        authorId: adminUserId
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    const recipients = await prisma.user.findMany({
      where: { id: { not: adminUserId }, suspended: false },
      select: { id: true }
    });
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((r) => ({
          recipientId: r.id,
          actorId: adminUserId,
          type: 'platform_announcement'
        }))
      });
    }

    res.status(201).json({ announcement });
  } catch (error) {
    console.error('Admin announcement error:', error);
    res.status(500).json({ message: 'Failed to publish announcement' });
  }
});

app.get('/api/newsletters/feed', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const [announcements, subs, ownedNewsletter] = await Promise.all([
      prisma.platformAnnouncement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } }
        }
      }),
      prisma.newsletterSubscription.findMany({
        where: { subscriberId: userId },
        select: { newsletterId: true }
      }),
      prisma.newsletter.findUnique({
        where: { userId },
        select: { id: true }
      })
    ]);

    const subIds = subs.map((s) => s.newsletterId);
    const ownedId = ownedNewsletter?.id;
    const newsletterIdsForFeed = [...new Set([...subIds, ...(ownedId ? [ownedId] : [])])];

    const posts =
      newsletterIdsForFeed.length > 0
        ? await prisma.newsletterPost.findMany({
            where: { newsletterId: { in: newsletterIdsForFeed } },
            orderBy: { createdAt: 'desc' },
            take: 80,
            include: {
              newsletter: {
                select: {
                  id: true,
                  title: true,
                  coverImageUrl: true,
                  userId: true,
                  user: { select: { id: true, firstName: true, lastName: true } }
                }
              }
            }
          })
        : [];

    const feed = [
      ...announcements.map((a) => ({
        kind: 'announcement',
        sortAt: a.createdAt,
        id: a.id,
        title: a.title,
        content: a.content,
        createdAt: a.createdAt,
        author: a.author
      })),
      ...posts.map((p) => ({
        kind: 'newsletter_post',
        sortAt: p.createdAt,
        id: p.id,
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
        newsletter: p.newsletter,
        isOwnNewsletter: p.newsletter?.userId === userId
      }))
    ].sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));

    res.status(200).json({ feed });
  } catch (error) {
    console.error('Newsletter feed error:', error);
    res.status(500).json({ message: 'Failed to load feed' });
  }
});

app.get('/api/newsletters/discover', async (req, res) => {
  try {
    const { userId, search } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const q = search && String(search).trim();
    const where = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } }
                  ]
                }
              }
            ]
          }
        : {})
    };

    const list = await prisma.newsletter.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePictureUrl: true } }
          }
        },
        _count: { select: { subscriptions: true, posts: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 60
    });

    const subscribed = await prisma.newsletterSubscription.findMany({
      where: { subscriberId: userId },
      select: { newsletterId: true }
    });
    const subSet = new Set(subscribed.map((s) => s.newsletterId));
    const newsletters = list.map((n) => ({
      ...n,
      isSubscribed: subSet.has(n.id),
      isOwner: n.userId === userId
    }));

    res.status(200).json({ newsletters });
  } catch (error) {
    console.error('Newsletter discover error:', error);
    res.status(500).json({ message: 'Failed to discover newsletters' });
  }
});

app.get('/api/newsletters/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const newsletter = await prisma.newsletter.findUnique({
      where: { userId },
      include: {
        posts: { orderBy: { createdAt: 'desc' } },
        _count: { select: { subscriptions: true } },
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!newsletter) return res.status(404).json({ message: 'No newsletter yet' });
    res.status(200).json({ newsletter });
  } catch (error) {
    console.error('Get user newsletter error:', error);
    res.status(500).json({ message: 'Failed to load newsletter' });
  }
});

app.get('/api/newsletters/:newsletterId', async (req, res) => {
  try {
    const { newsletterId } = req.params;
    const { viewerId } = req.query;

    const newsletter = await prisma.newsletter.findUnique({
      where: { id: newsletterId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePictureUrl: true } }
          }
        },
        posts: { orderBy: { createdAt: 'desc' }, take: 80 },
        _count: { select: { subscriptions: true } }
      }
    });
    if (!newsletter) return res.status(404).json({ message: 'Newsletter not found' });

    let isSubscribed = false;
    if (viewerId) {
      const row = await prisma.newsletterSubscription.findUnique({
        where: {
          subscriberId_newsletterId: { subscriberId: viewerId, newsletterId }
        }
      });
      isSubscribed = !!row;
    }

    res.status(200).json({ newsletter, isSubscribed });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ message: 'Failed to load newsletter' });
  }
});

app.post('/api/newsletters', async (req, res) => {
  try {
    const { userId, title, description, coverImageUrl } = req.body;
    if (!userId || !String(title || '').trim()) {
      return res.status(400).json({ message: 'userId and title are required' });
    }
    const descStr = description != null && String(description).trim() ? String(description).trim() : null;
    if (descStr && wordCount(descStr) > NEWSLETTER_MAX_WORDS) {
      return res.status(400).json({ message: `Description must be ${NEWSLETTER_MAX_WORDS} words or fewer` });
    }
    const existing = await prisma.newsletter.findUnique({ where: { userId } });
    if (existing) return res.status(400).json({ message: 'You already have a newsletter' });

    const newsletter = await prisma.newsletter.create({
      data: {
        userId,
        title: String(title).trim(),
        description: descStr,
        coverImageUrl: coverImageUrl != null && String(coverImageUrl).trim() ? String(coverImageUrl).trim() : null
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        posts: { orderBy: { createdAt: 'desc' } },
        _count: { select: { subscriptions: true, posts: true } }
      }
    });
    res.status(201).json({ newsletter });
  } catch (error) {
    console.error('Create newsletter error:', error);
    res.status(500).json({ message: 'Failed to create newsletter' });
  }
});

app.put('/api/newsletters/:newsletterId', async (req, res) => {
  try {
    const { newsletterId } = req.params;
    const { userId, title, description, coverImageUrl } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const nl = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
    if (!nl || nl.userId !== userId) return res.status(403).json({ message: 'Not allowed' });

    if (description !== undefined) {
      const descStr = description != null && String(description).trim() ? String(description).trim() : null;
      if (descStr && wordCount(descStr) > NEWSLETTER_MAX_WORDS) {
        return res.status(400).json({ message: `Description must be ${NEWSLETTER_MAX_WORDS} words or fewer` });
      }
    }

    const newsletter = await prisma.newsletter.update({
      where: { id: newsletterId },
      data: {
        ...(title != null ? { title: String(title).trim() } : {}),
        ...(description !== undefined
          ? { description: description != null && String(description).trim() ? String(description).trim() : null }
          : {}),
        ...(coverImageUrl !== undefined
          ? { coverImageUrl: coverImageUrl != null && String(coverImageUrl).trim() ? String(coverImageUrl).trim() : null }
          : {})
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        posts: { orderBy: { createdAt: 'desc' } },
        _count: { select: { subscriptions: true, posts: true } }
      }
    });
    res.status(200).json({ newsletter });
  } catch (error) {
    console.error('Update newsletter error:', error);
    res.status(500).json({ message: 'Failed to update newsletter' });
  }
});

app.post('/api/newsletters/:newsletterId/posts', async (req, res) => {
  try {
    const { newsletterId } = req.params;
    const { userId, title, content, imageUrl } = req.body;
    if (!userId || !String(title || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ message: 'userId, title, and content are required' });
    }
    const body = String(content).trim();
    if (wordCount(body) > NEWSLETTER_MAX_WORDS) {
      return res.status(400).json({ message: `Each issue must be ${NEWSLETTER_MAX_WORDS} words or fewer` });
    }

    const nl = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
    if (!nl || nl.userId !== userId) return res.status(403).json({ message: 'Not allowed' });

    const post = await prisma.newsletterPost.create({
      data: {
        newsletterId,
        title: String(title).trim(),
        content: body,
        imageUrl: imageUrl != null && String(imageUrl).trim() ? String(imageUrl).trim() : null
      }
    });

    const subs = await prisma.newsletterSubscription.findMany({
      where: { newsletterId },
      select: { subscriberId: true }
    });
    if (subs.length > 0) {
      await prisma.notification.createMany({
        data: subs.map((s) => ({
          recipientId: s.subscriberId,
          actorId: userId,
          type: 'newsletter_post'
        }))
      });
    }

    res.status(201).json({ post });
  } catch (error) {
    console.error('Create newsletter post error:', error);
    res.status(500).json({ message: 'Failed to publish post' });
  }
});

app.delete('/api/newsletters/:newsletterId/posts/:postId', async (req, res) => {
  try {
    const { newsletterId, postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const nl = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
    if (!nl || nl.userId !== userId) return res.status(403).json({ message: 'Not allowed' });

    const post = await prisma.newsletterPost.findFirst({
      where: { id: postId, newsletterId }
    });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    await prisma.newsletterPost.delete({ where: { id: postId } });
    res.status(200).json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete newsletter post error:', error);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

app.post('/api/newsletters/:newsletterId/subscribe', async (req, res) => {
  try {
    const { newsletterId } = req.params;
    const { subscriberId } = req.body;
    if (!subscriberId) return res.status(400).json({ message: 'subscriberId is required' });

    const nl = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
    if (!nl) return res.status(404).json({ message: 'Newsletter not found' });
    if (nl.userId === subscriberId) {
      return res.status(400).json({ message: 'You cannot subscribe to your own newsletter' });
    }

    try {
      await prisma.newsletterSubscription.create({
        data: { subscriberId, newsletterId }
      });
    } catch (e) {
      if (e.code === 'P2002') {
        return res.status(400).json({ message: 'Already subscribed' });
      }
      throw e;
    }

    res.status(200).json({ message: 'Subscribed' });
  } catch (error) {
    console.error('Subscribe newsletter error:', error);
    res.status(500).json({ message: 'Failed to subscribe' });
  }
});

app.delete('/api/newsletters/:newsletterId/subscribe', async (req, res) => {
  try {
    const { newsletterId } = req.params;
    const { subscriberId } = req.body;
    if (!subscriberId) return res.status(400).json({ message: 'subscriberId is required' });

    await prisma.newsletterSubscription.deleteMany({
      where: { newsletterId, subscriberId }
    });
    res.status(200).json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('Unsubscribe newsletter error:', error);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
});

// ==================== START SERVER ====================

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

// ==================== ADMIN ENDPOINTS ====================
 
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'buffbuzz@wtamu.edu';
 
// Admin auth middleware
function requireAdmin(req, res, next) {
  // For simplicity, admin routes are protected by checking a query/body param
  // In production you'd use JWT. For now trust the frontend gate.
  next();
}
 
// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers, totalPosts, totalGroups, totalJobs,
      totalMarketplace, totalLostFound, suspendedUsers,
      pendingReports, recentUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.group.count(),
      prisma.job.count(),
      prisma.marketplaceItem.count(),
      prisma.lostFoundItem.count(),
      prisma.user.count({ where: { suspended: true } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, email: true, userType: true, createdAt: true }
      })
    ]);
 
    res.status(200).json({
      stats: {
        totalUsers, totalPosts, totalGroups, totalJobs,
        totalMarketplace, totalLostFound, suspendedUsers,
        pendingReports, recentUsers
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    const where = search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ]
    } : {};
 
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, userType: true, verificationStatus: true,
        suspended: true, createdAt: true
      }
    });
 
    res.status(200).json({ users });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// PUT /api/admin/users/:userId/suspend
app.put('/api/admin/users/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { suspended } = req.body;
 
    const user = await prisma.user.update({
      where: { id: userId },
      data: { suspended }
    });
 
    res.status(200).json({ message: `User ${suspended ? 'suspended' : 'unsuspended'} successfully`, user });
  } catch (error) {
    console.error('Admin suspend user error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// DELETE /api/admin/users/:userId
app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
 
    await prisma.user.delete({ where: { id: userId } });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// GET /api/admin/posts
app.get('/api/admin/posts', requireAdmin, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { likes: true, comments: true } }
      }
    });
 
    res.status(200).json({ posts });
  } catch (error) {
    console.error('Admin get posts error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// DELETE /api/admin/posts/:postId
app.delete('/api/admin/posts/:postId', requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    await prisma.post.delete({ where: { id: postId } });
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    res.status(200).json({ reports });
  } catch (error) {
    console.error('Admin get reports error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
app.put('/api/admin/reports/:reportId', requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminId } = req.body;

    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) return res.status(404).json({ message: 'Report not found' });

    await prisma.report.update({
      where: { id: reportId },
      data: { status }
    });

    // Notify the reporter
    const reporterMessages = {
      'ACTION_TAKEN': 'Your report has been reviewed and action was taken. Thank you for helping keep BuffBuzz safe.',
      'DISMISSED':    'Your report was reviewed and no action was taken at this time.',
      'REVIEWED':     'Your report is currently being reviewed by our team. We will follow up shortly.',
    };

    if (reporterMessages[status]) {
      await prisma.notification.create({
        data: {
          recipientId: report.reporterId,
          actorId:     report.reporterId, // self-triggered
          type:        'report_update',
          read:        false
        }
      });
    }

    // If action taken and the target is a USER, notify that user with a warning
    if (status === 'ACTION_TAKEN' && report.targetType === 'USER') {
      await prisma.notification.create({
        data: {
          recipientId: report.targetId,
          actorId:     report.targetId, // self-triggered
          type:        'account_warning',
          read:        false
        }
      });
    }

    res.status(200).json({ message: 'Report updated', status });
  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});
 
// POST /api/report  (generic — works for any target type)
app.post('/api/report', async (req, res) => {
  try {
    const { reporterId, targetType, targetId, category, details } = req.body;

    if (!reporterId || !targetType || !targetId) {
      return res.status(400).json({ message: 'reporterId, targetType and targetId are required' });
    }

    const existing = await prisma.report.findUnique({
      where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } }
    });

    if (existing) {
      return res.status(400).json({ message: 'You have already reported this' });
    }

    const report = await prisma.report.create({
      data: { reporterId, targetType, targetId, category: category || 'OTHER', details: details || null }
    });

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});