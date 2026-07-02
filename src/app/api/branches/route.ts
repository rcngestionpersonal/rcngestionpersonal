import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(branches);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, city, address, phone, coach } = body;
    const branch = await prisma.branch.create({
      data: { name, city, address, phone, coach },
    });
    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
