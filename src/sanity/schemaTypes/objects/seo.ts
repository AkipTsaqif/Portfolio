import { defineField, defineType } from "sanity";

export const seoType = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "string",
      validation: (rule) =>
        rule
          .max(60)
          .warning("Search titles are usually truncated after 60 characters."),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
      rows: 3,
      validation: (rule) =>
        rule
          .max(160)
          .warning(
            "Search descriptions are usually truncated after 160 characters.",
          ),
    }),
    defineField({
      name: "socialImage",
      title: "Social sharing image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({ name: "canonicalUrl", title: "Canonical URL", type: "url" }),
  ],
});
