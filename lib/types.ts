export type Role = "admin" | "viewer";

export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: Role;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  lastContact: string;
  createdAt: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}
