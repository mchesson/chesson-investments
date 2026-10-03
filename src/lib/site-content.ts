// The website's starting words (home page, services, contact). Projects come
// from each project's Website tab. The phone, email, area and the longer texts
// (About, What We Do, Sell, Contact) can be changed on Leads → Website Settings
// (src/lib/site-settings.ts); these are what shows until they are.
export const siteContent = {
  tagline: 'New construction, land development & full renovations.',
  servicesTitle: 'Three ways we build value',
  servicesIntro: 'From raw land to finished homes, Chesson Investments takes on projects at every stage of the build.',
  services: [
    { icon: 'house', title: 'New Construction', text: 'Ground-up custom homes — designed, permitted, and built to last in the Triangle’s growing neighborhoods.' },
    { icon: 'land', title: 'Land Development', text: 'Acquiring and preparing raw and infill parcels — clearing, site work, and the steps that turn land into buildable lots.' },
    { icon: 'tools', title: 'Full Renovations', text: 'Down-to-the-studs rebuilds that modernize older homes with all-new systems, smarter layouts, and refined finishes.' },
  ],
  projectsTitle: 'Our work',
  projectsIntro: 'A look at the homes we’ve built and reimagined — each one with new systems, new layouts, and a careful eye on the details.',
  phone: '+19197958948',
  phoneShown: '(919) 795-8948',
  domain: 'chessoninvestments.com',
  area: 'Raleigh and the Triangle, North Carolina',
  email: null as string | null,
  aboutText: 'Chesson Investments, LLC is a real estate company in Raleigh and the Triangle, North Carolina. We take on projects at every stage of the build: buying land and infill lots, building new homes from the ground up, and fully renovating older homes.\n\nEvery project gets new systems, a layout that works for the way people live now, and a careful eye on the details. You can see our work on the Projects page.',
  whatWeDoIntro: 'From raw land to finished homes, Chesson Investments takes on projects at every stage of the build.',
  sellIntro: 'We look for lots, teardowns, land and homes that need a full renovation in Raleigh and the Triangle. If you have a property you’re thinking of selling, tell us about it here. We look at every property sent to us, and if it fits what we build, we’ll reach out to talk it over.',
  contactIntro: 'Questions about a project, a property or working with us? Send us a note and we’ll get back to you.',
};
