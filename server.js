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
  const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
  
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

// ==================== AUTHENTICATION ENDPOINTS ====================

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    
    const { email, password, firstName, lastName, userType } = req.body;

    if (!email || !password || !firstName || !lastName || !userType) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (userType !== 'student' && userType !== 'professor') {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    // Create user with PENDING verification status
    const user = await prisma.user.create({
      data: {
        email,
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
      await sendVerificationEmail(email, verificationCode, firstName);
      
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

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verificationStatus === 'VERIFIED') {
      return res.status(400).json({ message: 'User already verified' });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();

    // Update user with new code and reset attempts
    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        verificationAttempts: 0
      }
    });

    console.log(`New verification code generated for ${email}: ${verificationCode}`);

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationCode, user.firstName);
      
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

// Verification endpoint
app.post('/api/verify', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verificationStatus === 'VERIFIED') {
      return res.status(400).json({ message: 'User already verified' });
    }

    // Check if too many attempts
    if (user.verificationAttempts >= 3) {
      return res.status(400).json({ 
        message: 'Too many failed attempts. Please sign up again.' 
      });
    }

    // Check if verification code matches
    if (user.verificationCode !== verificationCode) {
      // Increment failed attempts
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { verificationAttempts: user.verificationAttempts + 1 }
      });

      const remainingAttempts = 3 - updatedUser.verificationAttempts;
      
      if (remainingAttempts <= 0) {
        return res.status(400).json({ 
          message: 'Too many failed attempts. Please sign up again.' 
        });
      }

      return res.status(400).json({ 
        message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.` 
      });
    }

    // Update user to verified
    const verifiedUser = await prisma.user.update({
      where: { email },
      data: {
        verificationStatus: 'VERIFIED',
        verificationCode: null,
        verificationAttempts: 0
      }
    });

    const { password: _, ...userWithoutPassword } = verifiedUser;

    res.status(200).json({
      message: 'Email verified successfully! Welcome to BuffBuzz!',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'An error occurred during verification' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.verificationStatus !== 'VERIFIED') {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { password: _, ...userWithoutPassword } = user;

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

    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists with this email, you will receive a reset link.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    console.log(`Reset token generated for ${email}`);

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken, user.firstName);
      
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
    const viewerId = req.query.viewerId; // Optional: ID of the user viewing the profile

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
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

    // Privacy check logic
    const isOwner = viewerId && viewerId === userId;
    let canViewFullProfile = false;
    let canViewPartialProfile = false;

    if (isOwner) {
      // Owner can always see their own profile
      canViewFullProfile = true;
      canViewPartialProfile = true;
    } else if (profile.privacy === 'PUBLIC') {
      // Public profiles can be viewed by anyone
      canViewFullProfile = true;
      canViewPartialProfile = true;
    } else if (profile.privacy === 'FRIENDS_ONLY' && viewerId) {
      // Friends-only: check if viewer is a friend
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
          ]
        }
      });
      
      if (friendship) {
        canViewFullProfile = true;
        canViewPartialProfile = true;
      } else {
        // Not friends - only show basic info
        canViewPartialProfile = true;
      }
    } else if (profile.privacy === 'PRIVATE') {
      // Private profiles - only show basic info to non-owners
      if (viewerId) {
        canViewPartialProfile = true;
      } else {
        // No viewer specified - treat as public but with limited info
        canViewPartialProfile = true;
      }
    } else {
      // No viewer ID provided - show partial info
      canViewPartialProfile = true;
    }

    // Filter profile data based on privacy
    let profileData = { ...profile };
    
    if (!canViewFullProfile) {
      // Hide sensitive information for non-friends/private profiles
      profileData = {
        ...profileData,
        bio: canViewPartialProfile ? profileData.bio : null,
        major: canViewPartialProfile ? profileData.major : null,
        department: canViewPartialProfile ? profileData.department : null,
        graduationYear: canViewPartialProfile ? profileData.graduationYear : null,
        classification: canViewPartialProfile ? profileData.classification : null,
        clubs: canViewPartialProfile ? profileData.clubs : null,
        instagramHandle: canViewPartialProfile ? profileData.instagramHandle : null,
        linkedinUrl: canViewPartialProfile ? profileData.linkedinUrl : null,
        facebookHandle: canViewPartialProfile ? profileData.facebookHandle : null,
        email: canViewPartialProfile ? profile.user?.email : null
      };
      
      // Always show name and pronouns if available
      if (profileData.privacy === 'PRIVATE' && !isOwner) {
        // For private profiles, hide more info
        profileData.bio = null;
        profileData.major = null;
        profileData.department = null;
        profileData.graduationYear = null;
        profileData.classification = null;
        profileData.clubs = null;
        profileData.instagramHandle = null;
        profileData.linkedinUrl = null;
        profileData.facebookHandle = null;
      }
    }

    res.status(200).json({ 
      profile: profileData,
      canViewFullProfile,
      privacy: profile.privacy
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
    const { title, content, imageUrl, authorId } = req.body;

    if (!title || !content || !authorId) {
      return res.status(400).json({ message: 'Title, content, and author are required' });
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        imageUrl,
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

    // Add isLiked flag for each post
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: userId ? post.likes?.length > 0 : false,
      likes: undefined // Remove likes array from response
    }));

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

    res.status(200).json({ post });

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
    const { userId, content } = req.body;

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

// Get comments for a post
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { postId },
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

// ==================== HEALTH CHECK ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
