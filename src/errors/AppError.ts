export class AppError extends Error {
  constructor(msg: string, public status = 500) {
    super(msg);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(msg = 'Recurso não encontrado') {
    super(msg, 404);
  }
}

export class ConflictError extends AppError {
  constructor(msg = 'Conflito de dados') {
    super(msg, 409);
  }
}

export class ValidationError extends AppError {
  constructor(msg = 'Dados inválidos') {
    super(msg, 400);
  }
}
