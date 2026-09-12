import z from 'zod';

export const CommentDto = z.object({
    request_id: z.number().gt(0),
    comment: z.string().nonempty()
});