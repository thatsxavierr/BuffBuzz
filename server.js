// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});