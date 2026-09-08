import { PrismaClient } from '@prisma/client'; //내 스키마로 맞춤 제작된 DB 클라이언트 설계도를 가져와라
const prisma = new PrismaClient(); //그걸로 실제 연결 관리자 객체를 만든다

const HLS_SAMPLES = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
];

async function main() {
  // 여러 번 실행해도 결과가 같도록 기존 샘플 데이터를 먼저 지운다 (사용자 계정은 유지)
  // 외래키 순서: enrollments, lectures가 courses를 참조하므로 자식부터 삭제
  await prisma.enrollment.deleteMany();
  await prisma.lecture.deleteMany();
  await prisma.course.deleteMany();

  for (let c = 1; c <= 12; c++) {
    const course = await prisma.course.create({
      data: {
        title: `샘플 강의 코스 ${c}`,
        description: `코스 ${c}에 대한 설명입니다. 5개의 강의로 구성되어 있습니다.`,
        thumbnail: `https://picsum.photos/seed/course${c}/640/360`,
        instructor: `강사 ${c}`,
      },
    });
    for (let l = 1; l <= 5; l++) {
      await prisma.lecture.create({
        data: {
          courseId: course.id,
          title: `${l}강 - 샘플 강의`,
          duration: 600, // 10분
          videoUrl: HLS_SAMPLES[(l - 1) % HLS_SAMPLES.length], // 나머지 0, 1만 발생하여 영상 두개를 번갈아가며 사용
          order: l * 10, // 재생 순서, 중간에 강의가 추가(15, 25, ...)될 수 있으므로 10 단위로 설정
        },
      });
    }
  }
  console.log('seed done');
}

main().finally(() => prisma.$disconnect()); // 연결 종료, 연결 종료 안 하면 prisma client가 계속 살아있어서 프로세스가 종료되지 않는다
