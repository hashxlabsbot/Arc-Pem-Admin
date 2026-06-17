import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db'
process.env.DATABASE_URL = DATABASE_URL

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Clean existing data
  await prisma.user.deleteMany()
  await prisma.plan.deleteMany()

  // Create Plans
  const soloPlan = await prisma.plan.create({
    data: {
      name: 'Solo',
      price: 4999,
      period: 'month',
      description: 'Perfect for individual contractors and freelancers',
      features: JSON.stringify([
        'Up to 10 projects',
        '1 user seat',
        'Expense tracking',
        'Basic reports',
        'Email support',
      ]),
      maxProjects: 10,
      maxUsers: 1,
      isActive: true,
    },
  })

  const studioPlan = await prisma.plan.create({
    data: {
      name: 'Studio',
      price: 9999,
      period: 'month',
      description: 'Ideal for small teams and growing studios',
      features: JSON.stringify([
        'Up to 50 projects',
        '10 user seats',
        'Advanced expense tracking',
        'Custom reports',
        'Budget alerts',
        'Priority support',
        'API access',
      ]),
      maxProjects: 50,
      maxUsers: 10,
      isActive: true,
    },
  })

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      price: 0,
      period: 'month',
      description: 'Custom solution for large organizations',
      features: JSON.stringify([
        'Unlimited projects',
        'Unlimited user seats',
        'Advanced analytics',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'On-premise option',
        'SSO support',
      ]),
      maxProjects: 9999,
      maxUsers: 9999,
      isActive: true,
    },
  })

  // Create Admin
  const adminPassword = await bcrypt.hash('Admin@123', 10)
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@arcpem.com',
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
  })

  // Sample users
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  const sampleUsers = [
    {
      name: 'Arjun Sharma',
      email: 'arjun.sharma@buildco.in',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: studioPlan.id,
      createdAt: new Date(lastMonth.getTime() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Priya Nair',
      email: 'priya.nair@constructionhub.com',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: soloPlan.id,
      createdAt: new Date(lastMonth.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Rohit Mehta',
      email: 'rohit.mehta@infratech.co',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'INACTIVE',
      planId: soloPlan.id,
      createdAt: new Date(twoMonthsAgo.getTime() + 10 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Sunita Patel',
      email: 'sunita.patel@pemgroup.in',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: enterprisePlan.id,
      createdAt: new Date(twoMonthsAgo.getTime() + 15 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Vikram Raju',
      email: 'vikram.raju@archcon.com',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'SUSPENDED',
      planId: null,
      createdAt: new Date(threeMonthsAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Kavita Reddy',
      email: 'kavita.reddy@designstudio.in',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: studioPlan.id,
      createdAt: new Date(now.getFullYear(), now.getMonth(), 3),
    },
    {
      name: 'Deepak Verma',
      email: 'deepak.verma@mepservices.co',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: soloPlan.id,
      createdAt: new Date(now.getFullYear(), now.getMonth(), 7),
    },
    {
      name: 'Ananya Krishnan',
      email: 'ananya.k@urbanpem.com',
      password: await bcrypt.hash('Password@123', 10),
      role: 'USER',
      status: 'ACTIVE',
      planId: studioPlan.id,
      createdAt: new Date(now.getFullYear(), now.getMonth(), 12),
    },
  ]

  for (const user of sampleUsers) {
    await prisma.user.create({ data: user })
  }

  console.log('Seed completed successfully!')
  console.log(`Created 3 plans: Solo, Studio, Enterprise`)
  console.log(`Created 1 admin + 8 sample users`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
