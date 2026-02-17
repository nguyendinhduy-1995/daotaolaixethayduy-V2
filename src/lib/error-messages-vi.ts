export type ErrorMessageVi = {
  title: string;
  message: string;
};

const DEFAULT_ERROR_MESSAGE: ErrorMessageVi = {
  title: "Có lỗi xảy ra",
  message: "Có lỗi xảy ra, vui lòng thử lại.",
};

const ERROR_MESSAGES_VI: Record<string, ErrorMessageVi> = {
  AUTH_MISSING_BEARER: {
    title: "Chưa đăng nhập",
    message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  },
  AUTH_INVALID_TOKEN: {
    title: "Phiên đăng nhập hết hạn",
    message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  },
  AUTH_UNAUTHENTICATED: {
    title: "Chưa đăng nhập",
    message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  },
  AUTH_UNAUTHORIZED: {
    title: "Không thể xác thực",
    message: "Thông tin đăng nhập không chính xác.",
  },
  AUTH_FORBIDDEN: {
    title: "Không có quyền truy cập",
    message: "Bạn không có quyền thực hiện thao tác này.",
  },
  VALIDATION_ERROR: {
    title: "Dữ liệu không hợp lệ",
    message: "Vui lòng kiểm tra lại thông tin đã nhập.",
  },
  NOT_FOUND: {
    title: "Không tìm thấy dữ liệu",
    message: "Không tìm thấy dữ liệu yêu cầu.",
  },
  RATE_LIMIT: {
    title: "Thao tác quá nhanh",
    message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  },
  INTERNAL_ERROR: {
    title: "Lỗi hệ thống",
    message: "Hệ thống đang bận. Vui lòng thử lại sau.",
  },
};

export function getErrorMessageVi(code?: string): ErrorMessageVi {
  if (!code) return DEFAULT_ERROR_MESSAGE;
  return ERROR_MESSAGES_VI[code] ?? DEFAULT_ERROR_MESSAGE;
}
