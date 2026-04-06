import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: 'buffbuzz2025@gmail.com' }
    });

    if (existing) {
      console.log('Admin account already exists!');
      await prisma.$disconnect();
      return;
    }

    const hashedPassword = await bcrypt.hash('BuffBuzz@Admin2025', 10);

    await prisma.user.create({
      data: {
        email:              'buffbuzz2025@gmail.com',
        password:           hashedPassword,
        firstName:          'BuffBuzz',
        lastName:           'Admin',
        userType:           'STUDENT',
        verificationStatus: 'VERIFIED',
        suspended:          false,
      }
    });

    console.log('✅ Admin created! Email: buffbuzz2025@gmail.com | Password: BuffBuzz@Admin2025');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
