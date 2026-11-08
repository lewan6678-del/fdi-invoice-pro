/** Lỗi nghiệp vụ có thông báo tiếng Việt và hướng khắc phục cho người dùng. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthenticated: () =>
    new AppError(401, "UNAUTHENTICATED", "Bạn chưa đăng nhập hoặc phiên đã hết hạn.", "Vui lòng đăng nhập lại."),
  forbidden: (what = "thực hiện thao tác này") =>
    new AppError(403, "FORBIDDEN", `Bạn không có quyền ${what}.`, "Liên hệ Quản trị công ty để được cấp quyền phù hợp."),
  notFound: (what = "Dữ liệu") =>
    new AppError(404, "NOT_FOUND", `${what} không tồn tại hoặc bạn không có quyền truy cập.`, "Kiểm tra lại công ty đang chọn ở thanh trên cùng."),
  validation: (message: string, hint?: string) => new AppError(400, "VALIDATION", message, hint),
  conflict: (message: string, hint?: string) => new AppError(409, "CONFLICT", message, hint),
};
