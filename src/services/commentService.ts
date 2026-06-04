import type { CommentEntry } from '../types/domain';
import { apiRequest } from './api';

interface CommentsResponse {
  comments: CommentEntry[];
}

interface CommentResponse {
  comment: CommentEntry;
}

export const fetchComments = async (rfpId: string): Promise<CommentEntry[]> => {
  const response = await apiRequest<CommentsResponse>(`/comments?rfpId=${encodeURIComponent(rfpId)}`);
  return response.comments;
};

export const createComment = async (input: {
  rfpId: string;
  vendorId: string;
  criterionId: string;
  scope: string;
  text: string;
}): Promise<CommentEntry> => {
  const response = await apiRequest<CommentResponse>('/comments', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.comment;
};
