import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching base data...');
  const groups = await prisma.group.findMany({ include: { students: true } });
  const teachers = await prisma.teacher.findMany();
  const disciplines = await prisma.discipline.findMany();
  
  let semester = await prisma.semester.findFirst({ orderBy: { startDate: 'desc' } });

  if (!semester) {
    console.log('No semester found, creating a test semester...');
    semester = await prisma.semester.create({
      data: {
        name: 'Test Semester 2026',
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
      }
    });
  }

  if (groups.length === 0 || teachers.length === 0 || disciplines.length === 0) {
    console.error('Not enough basic data (groups, teachers, disciplines) to generate schedule.');
    return;
  }

  console.log(`Found ${groups.length} groups, ${teachers.length} teachers, ${disciplines.length} disciplines.`);

  const startTotal = new Date('2026-09-12T00:00:00+06:00'); 
  const cutoffTotal = new Date('2026-09-12T21:00:00+06:00');
  const endTotal = new Date('2026-09-16T23:00:00+06:00');

  const stepMs = 40 * 60 * 1000; // 40 minutes

  console.log('Generating class sessions and attendance...');
  
  let sessionCount = 0;
  let attendanceCount = 0;

  for (let time = startTotal.getTime(); time < endTotal.getTime(); time += stepMs) {
    const startTime = new Date(time);
    const endTime = new Date(time + stepMs);
    const isPast = time < cutoffTotal.getTime();

    for (const group of groups) {
      const teacher = teachers[Math.floor(Math.random() * teachers.length)];
      const discipline = disciplines[Math.floor(Math.random() * disciplines.length)];

      const session = await prisma.classSession.create({
        data: {
          source: 'TEST_SCRIPT',
          scheduleExternalId: `test-${group.id}-${time}`,
          gaudiId: `test-gaudi-${group.id}-${time}`,
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId: teacher.id,
          semesterId: semester.id,
          startTime,
          endTime,
          status: isPast ? 'completed' : 'scheduled'
        }
      });
      sessionCount++;

      if (isPast) {
        const attendanceData = group.students.map(student => {
          const statuses = ['present', 'absent', 'late', 'excused'];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          return {
            classSessionId: session.id,
            studentId: student.id,
            semesterId: semester!.id,
            status,
            gaudiId: `test-gaudi-att-${student.id}-${session.id}`
          };
        });

        if (attendanceData.length > 0) {
          await prisma.attendance.createMany({
            data: attendanceData
          });
          attendanceCount += attendanceData.length;
        }
      }
    }
  }

  console.log(`Successfully generated ${sessionCount} class sessions and ${attendanceCount} attendance records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
