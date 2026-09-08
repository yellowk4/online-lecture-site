// 목록 API 공통 응답 형태. T에 항목 타입을 넣어 쓴다.
// 예) Paginated<CourseSummary>, Paginated<EnrollmentSummary>
export interface Paginated<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

// 페이지네이션 UI처럼 항목 내용은 필요 없고 페이지 정보만 필요한 곳에서 사용
export type PageInfo = Omit<Paginated<unknown>, 'items'>;
