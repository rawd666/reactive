export interface Project {
  name: string;
  url: string;
  label: string;
  description: string;
  // Full-page height of the site in px, so the expanded preview scrolls it all.
  previewHeight: number;
}

export const PROJECTS: Project[] = [
  {
    name: "Amplified Jo",
    url: "https://amplified-jo.com",
    label: "amplified-jo.com",
    description: "A custom React site built from scratch, no templates.",
    previewHeight: 4600,
  },
];
