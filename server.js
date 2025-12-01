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

    console.log('Profile check:', { userId, viewerId, isOwner, privacy });

    if (isOwner) {
      console.log('Owner viewing own profile');
      canViewFullProfile = true;
    } else if (privacy === 'PUBLIC') {
      console.log('Public profile - allowing full view');
      canViewFullProfile = true;
    } else if (privacy === 'FRIENDS_ONLY' && viewerId) {
      console.log('Checking friendship status');
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
          ]
        }
      });
      canViewFullProfile = !!friendship;
      console.log('Friendship found:', !!friendship);
    } else {
      console.log('Private profile or no viewer - hiding details');
    }

    // If can view full profile, return everything
    if (canViewFullProfile) {
      console.log('Returning full profile data');
      return res.status(200).json({ 
        profile: profile,
        canViewFullProfile: true,
        privacy: privacy
      });
    }

    // Otherwise, return limited data
    console.log('Returning limited profile data');
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
    const { category } = req.query;

    const whereClause = category && category !== 'ALL_JOBS' ? { category } : {};

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

// ==================== MARKETPLACE ENDPOINTS ====================

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
      sellerId
    } = req.body;

    if (!title || !description || !price || !category || !condition || !sellerId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const item = await prisma.marketplaceItem.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        category,
        condition,
        imageUrl: imageUrl || null,
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

    res.status(201).json({
      message: 'Item listed successfully',
      item
    });

  } catch (error) {
    console.error('Create marketplace item error:', error);
    res.status(500).json({ message: 'An error occurred while listing the item' });
  }
});

// Get all marketplace items with optional filtering
app.get('/api/marketplace', async (req, res) => {
  try {
    const { category } = req.query;

    const whereClause = category && category !== 'all' ? { category } : {};

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
            lastName: true
          }
        }
      }
    });

    // Format items with seller name
    const formattedItems = items.map(item => ({
      ...item,
      sellerName: `${item.seller.firstName} ${item.seller.lastName}`
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

    res.status(200).json({ item });

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
      userId
    } = req.body;

    if (!title || !description || !category || !location || !date || !contactInfo || !userId) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const item = await prisma.lostFoundItem.create({
      data: {
        title,
        description,
        category,
        location,
        date: new Date(date),
        contactInfo,
        imageUrl: imageUrl || null,
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

    res.status(201).json({
      message: 'Item posted successfully',
      item
    });

  } catch (error) {
    console.error('Create lost/found item error:', error);
    res.status(500).json({ message: 'An error occurred while posting the item' });
  }
});

// Get all lost/found items with optional filtering
app.get('/api/lostfound', async (req, res) => {
  try {
    const { category } = req.query;

    const whereClause = category && category !== 'all' ? { category } : {};

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
            lastName: true
          }
        }
      }
    });

    // Format items with user name
    const formattedItems = items.map(item => ({
      ...item,
      userName: `${item.user.firstName} ${item.user.lastName}`
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

    res.status(200).json({ item });

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
    const groups = await prisma.group.findMany({
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

    res.status(200).json({ message: 'Successfully left the group' });

  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'An error occurred while leaving the group' });
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
