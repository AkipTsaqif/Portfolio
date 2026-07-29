export const siteConfig = {
  name: "Akip Tsaqif",
  role: "Web developer & digital maker",
  description:
    "A web developer building thoughtful digital products and documenting the places that inspire them.",
  email: "akiptsaqif@gmail.com",
  location: "Based in Indonesia · Available worldwide",
  socialLinks: [
    { label: "GitHub", href: "https://github.com/AkipTsaqif" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/sri-ahmad-tsaqif" },
  ],
} as const;

export const navigation = [
  { label: "Home", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Journal", href: "/blog" },
  { label: "Lab", href: "/lab" },
  { label: "Contact", href: "/contact" },
] as const;
