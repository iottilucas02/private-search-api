export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_error"
  ) {
    super(message);
  }
}

export function errorToResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  console.error(error);

  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Unexpected server error"
      }
    },
    { status: 500 }
  );
}
