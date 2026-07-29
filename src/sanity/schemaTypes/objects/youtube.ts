import { defineField, defineType } from "sanity";

const youtubePattern =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{6,}/;

export const youtubeType = defineType({
  name: "youtube",
  title: "YouTube video",
  type: "object",
  fields: [
    defineField({
      name: "url",
      title: "YouTube URL",
      type: "url",
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              !value ||
              youtubePattern.test(value) ||
              "Enter a valid YouTube URL.",
          ),
    }),
    defineField({
      name: "title",
      title: "Accessible title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "caption", title: "Caption", type: "string" }),
  ],
  preview: { select: { title: "title", subtitle: "url" } },
});
