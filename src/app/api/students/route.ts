import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { branchId, guardianId, active } = Object.fromEntries(request.nextUrl.searchParams.entries());
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (guardianId) where.guardianId = guardianId;
    if (active) where.active = active === 'true';

    const students = await prisma.student.findMany({
      where,
      include: {
        branch: true,
        guardian: true,
      },
      orderBy: { lastName: 'asc' },
    });
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, birthDate, category, branchId, guardianId, notes } = body;
    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        category,
        branchId,
        guardianId,
        notes,
      },
    });
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
