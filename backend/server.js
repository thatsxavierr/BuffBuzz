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

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize email to lowercase for case-insensitive auth and consistent DB storage
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
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

// Send verification email
async function sendVerificationEmail(email, verificationCode, firstName) {
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

// ==================== AUTHENTICATION ENDPOINTS ====================

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    const { email, password, firstName, lastName, userType, department } = req.body;

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
        department,
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
    const { title, content, imageUrl, imageUrls, authorId } = req.body;

    if (!title || !content || !authorId) {
      return res.status(400).json({ message: 'Title, content, and author are required' });
    }

    // Support both single imageUrl (legacy) and imageUrls array
    let storedImageUrl = imageUrl;
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      storedImageUrl = JSON.stringify(imageUrls);
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        imageUrl: storedImageUrl,
        authorId
      },
      include: {
        author: {
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
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'An error occurred while creating the post' });
  }
});

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const { userId } = req.query; // Optional: to check if current user liked posts

    const posts = await prisma.post.findMany({
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
        } : false
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

    res.status(200).json({ posts: postsWithLikeStatus });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'An error occurred while fetching posts' });
  }
});

// Get single post
app.get('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

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
        }
      }
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const imageUrls = parsePostImages(post.imageUrl);
    const postWithImages = {
      ...post,
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      imageUrl: imageUrls[0] || post.imageUrl
    };

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
    if (post.authorId !== userId) {
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

// Get list of users who liked a post
app.get('/api/posts/:postId/likes', async (req, res) => {
  try {
    const { postId } = req.params;

    const likes = await prisma.like.findMany({
      where: { postId },
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
      },
      orderBy: { createdAt: 'desc' }
    });

    const likers = likes.map((like) => ({
      id: like.user.id,
      firstName: like.user.firstName,
      lastName: like.user.lastName,
      profile: like.user.profile ? { profilePictureUrl: like.user.profile.profilePictureUrl } : null
    }));

    res.status(200).json({ likers });
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ message: 'An error occurred while fetching likes' });
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

    // Create notification for post author (don't notify if they commented on their own post)
    if (post.authorId !== userId) {
      await prisma.notification.create({
        data: {
          recipientId: post.authorId,
          actorId: userId,
          type: 'comment',
          postId
        }
      });
    }

    // Create mention notifications for each mentioned user
    const mentionedIds = Array.isArray(mentionedUserIds) ? [...new Set(mentionedUserIds)].filter(Boolean) : [];
    for (const mentionedId of mentionedIds) {
      if (mentionedId === userId) continue; // Don't notify yourself
      if (mentionedId === post.authorId) continue; // Post author already gets "comment" notification
      await prisma.notification.create({
        data: {
          recipientId: mentionedId,
          actorId: userId,
          type: 'mention',
          postId
        }
      });
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

    // Create notification for comment owner (don't notify if replying to your own comment)
    if (parentComment.authorId !== userId) {
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

    // Create mention notifications for each mentioned user
    const mentionedIds = Array.isArray(mentionedUserIds) ? [...new Set(mentionedUserIds)].filter(Boolean) : [];
    for (const mentionedId of mentionedIds) {
      if (mentionedId === userId) continue;
      if (mentionedId === parentComment.authorId) continue;
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

    res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'An error occurred while updating password' });
  }
});

// Get Notification Preferences
app.get('/api/settings/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    // If no preferences exist, return defaults
    if (!preferences) {
      return res.status(200).json({
        preferences: {
          emailNotifications: true,
          pushNotifications: true,
          postLikes: true,
          comments: true,
          newFollowers: true
        }
      });
    }

    res.status(200).json({ preferences });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'An error occurred while fetching preferences' });
  }
});

// Update Notification Preferences
app.put('/api/settings/notifications', async (req, res) => {
  try {
    const {
      userId,
      emailNotifications,
      pushNotifications,
      postLikes,
      comments,
      newFollowers
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Upsert preferences
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: {
        emailNotifications,
        pushNotifications,
        postLikes,
        comments,
        newFollowers
      },
      create: {
        userId,
        emailNotifications,
        pushNotifications,
        postLikes,
        comments,
        newFollowers
      }
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

// ==================== NOTIFICATIONS ====================

// Get unread notification count for a user
app.get('/api/notifications/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await prisma.notification.count({
      where: {
        recipientId: userId,
        OR: [{ read: false }, { read: null }]
      }
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ message: 'An error occurred while fetching unread count' });
  }
});

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
      message: n.type === 'like' ? 'liked your post' : n.type === 'comment' ? 'commented on your post' : n.type === 'mention' ? 'mentioned you in a comment' : n.type === 'reply' ? 'replied to your comment' : n.type === 'marketplace_listing' ? 'listed a new item for sale' : n.type === 'lostfound_listing' ? 'posted a new lost & found item' : n.type === 'lostfound_resolved' ? 'marked a lost & found item as resolved' : n.type === 'group_join_request' ? 'requested to join your group' : n.type === 'group_join_approved' ? 'approved your request to join the group' : n.type === 'group_join_denied' ? 'denied your request to join the group' : n.type === 'group_member_removed' ? 'removed you from the group' : n.type === 'direct_message' ? 'sent you a message' : n.type === 'group_message' ? 'sent a message in the group' : n.type === 'group_chat_mention' ? 'tagged you in a group chat' : n.type
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
      if (uniqueRecipientIds.length > 0) {
        await prisma.notification.createMany({
          data: uniqueRecipientIds.map(recipientId => ({
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

    await prisma.notification.create({
      data: {
        recipientId: group.creatorId,
        actorId: userId,
        type: 'group_join_request',
        groupId,
        groupJoinRequestId: request.id
      }
    });

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

    await prisma.notification.create({
      data: {
        recipientId: joinRequest.userId,
        actorId: ownerId,
        type: 'group_join_approved',
        groupId
      }
    });

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

    await prisma.notification.create({
      data: {
        recipientId: joinRequest.userId,
        actorId: ownerId,
        type: 'group_join_denied',
        groupId
      }
    });

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

    // Notify each recipient (other participants) about the new message
    const recipientIds = conversation.participants
      .map(p => p.userId)
      .filter(id => id !== senderId);
    const notificationType = conversation.isGroupChat ? 'group_message' : 'direct_message';
    for (const recipientId of recipientIds) {
      await prisma.notification.create({
        data: {
          recipientId,
          actorId: senderId,
          type: notificationType,
          conversationId
        }
      });
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
          if (matched) {
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

// ==================== HEALTH CHECK ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
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
