import { defineArrayMember, defineField, defineType } from "sanity";

export const galleryType = defineType({
  name: "gallery",
  title: "Image gallery",
  type: "object",
  fields: [
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      validation: (rule) => rule.required().min(2),
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({ name: "caption", title: "Caption", type: "string" }),
            defineField({ name: "credit", title: "Credit", type: "string" }),
          ],
        }),
      ],
    }),
    defineField({ name: "caption", title: "Gallery caption", type: "string" }),
  ],
  preview: {
    select: { images: "images" },
    prepare: ({ images }) => ({
      title: `Gallery · ${images?.length ?? 0} images`,
      media: images?.[0],
    }),
  },
});
