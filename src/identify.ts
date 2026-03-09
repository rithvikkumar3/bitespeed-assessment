import prisma from "./prisma";

export async function identifyContact(email: string | null, phoneNumber: string | null) {
  
  // find contacts that match email or phone
  const matches = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    },
  });

  // no matches - create a new primary contact
  if (matches.length === 0) {
    const contact = await prisma.contact.create({
      data: { email, phoneNumber, linkPrecedence: "primary" },
    });
    return buildResponse(contact, []);
  }

  // get all primary IDs from matches
  const primaryIds: number[] = [];
  for (const c of matches) {
    const pid = c.linkPrecedence === "primary" ? c.id : c.linkedId!;
    if (!primaryIds.includes(pid)) primaryIds.push(pid);
  }

  // fetch all contacts in these clusters
  let cluster = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: { in: primaryIds } }, { linkedId: { in: primaryIds } }],
    },
    orderBy: { createdAt: "asc" },
  });

  // oldest primary wins
  const primaries = cluster.filter(c => c.linkPrecedence === "primary");
  const winner = primaries[0]; // already sorted by createdAt asc

  // if there are multiple primaries, demote the newer ones
  for (const p of primaries) {
    if (p.id !== winner.id) {
      await prisma.contact.update({
        where: { id: p.id },
        data: { linkPrecedence: "secondary", linkedId: winner.id },
      });
      await prisma.contact.updateMany({
        where: { linkedId: p.id },
        data: { linkedId: winner.id },
      });
    }
  }

  // re-fetch cluster after any demotions
  cluster = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: winner.id }, { linkedId: winner.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  // check if incoming request has new info
  const knownEmails = cluster.map(c => c.email);
  const knownPhones = cluster.map(c => c.phoneNumber);
  const isNewEmail = email && !knownEmails.includes(email);
  const isNewPhone = phoneNumber && !knownPhones.includes(phoneNumber);

  if (isNewEmail || isNewPhone) {
    const secondary = await prisma.contact.create({
      data: { email, phoneNumber, linkedId: winner.id, linkPrecedence: "secondary" },
    });
    cluster.push(secondary);
  }

  const secondaries = cluster.filter(c => c.id !== winner.id);
  return buildResponse(winner, secondaries);
}

function buildResponse(primary: any, secondaries: any[]) {
  const emails = [primary.email, ...secondaries.map(c => c.email)]
    .filter((e, i, arr) => e && arr.indexOf(e) === i) as string[];

  const phones = [primary.phoneNumber, ...secondaries.map(c => c.phoneNumber)]
    .filter((p, i, arr) => p && arr.indexOf(p) === i) as string[];

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers: phones,
      secondaryContactIds: secondaries.map(c => c.id),
    },
  };
}