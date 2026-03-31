import { ObjectId } from "mongodb"

export type SubmissionStatus = "new" | "seen" | "replied" | "archived"

export interface FormSubmission {
  _id?: ObjectId
  site: string
  data: Record<string, unknown>
  status: SubmissionStatus
  createdAt: Date
  updatedAt: Date
}

export interface SubmissionResponse {
  _id: string
  site: string
  data: Record<string, unknown>
  status: SubmissionStatus
  createdAt: string
  updatedAt: string
}
