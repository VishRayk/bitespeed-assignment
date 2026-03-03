import 'dotenv/config';
import express, { Request, Response } from 'express';
// @ts-ignore
import { PrismaClient } from '../generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Bitespeed Identity Reconciliation API is running');
});

// Implementation will go here
app.post('/identify', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            res.status(400).json({ error: "Email or phoneNumber is required." });
            return;
        }

        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;

        // 1. Find all contacts matching either email or phone
        const matchingContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: emailStr ?? undefined },
                    { phoneNumber: phoneStr ?? undefined },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });

        if (matchingContacts.length === 0) {
            // Create new primary contact
            const newContact = await prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkPrecedence: 'primary',
                },
            });
            res.status(200).json({
                contact: {
                    primaryContactId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: [],
                },
            });
            return;
        }

        // 2. Identify the absolute primary contact (oldest)
        const primaryContacts = matchingContacts.filter((c: any) => c.linkPrecedence === 'primary');
        let primaryContact = matchingContacts[0]; // oldest match

        // If there were multiple primary contacts matched, we need to link them
        if (primaryContacts.length > 1) {
            // Find the absolute oldest primary contact
            primaryContact = primaryContacts.reduce((oldest: any, current: any) =>
                (current.createdAt < oldest.createdAt ? current : oldest)
            );

            const otherPrimaryIds = primaryContacts
                .filter((c: any) => c.id !== primaryContact.id)
                .map((c: any) => c.id);

            // Downgrade other primary contacts to secondary
            await prisma.contact.updateMany({
                where: { id: { in: otherPrimaryIds } },
                data: {
                    linkPrecedence: 'secondary',
                    linkedId: primaryContact.id,
                },
            });

            // Also update any secondaries that were pointing to the old primaries
            await prisma.contact.updateMany({
                where: { linkedId: { in: otherPrimaryIds } },
                data: { linkedId: primaryContact.id }
            });
        } else if (matchingContacts[0].linkPrecedence === 'secondary') {
            // If the oldest match is a secondary, we need to find its absolute root primary
            let currentContact = matchingContacts[0];
            while (currentContact.linkedId) {
                const parent = await prisma.contact.findUnique({ where: { id: currentContact.linkedId } });
                if (!parent) break;
                currentContact = parent;
                if (currentContact.linkPrecedence === 'primary') break;
            }
            primaryContact = currentContact;
        } else {
            primaryContact = matchingContacts.find((c: any) => c.linkPrecedence === 'primary') || matchingContacts[0];
        }


        // 3. Check if we need to create a new secondary contact
        const hasMatchingEmail = emailStr ? matchingContacts.some((c: any) => c.email === emailStr) : true;
        const hasMatchingPhone = phoneStr ? matchingContacts.some((c: any) => c.phoneNumber === phoneStr) : true;

        if (!hasMatchingEmail || !hasMatchingPhone) {
            await prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkedId: primaryContact.id,
                    linkPrecedence: 'secondary',
                },
            });
        }

        // 4. Gather all contacts linked to this primary (including the primary itself)
        const allLinkedContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: primaryContact.id },
                    { linkedId: primaryContact.id },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });

        // 5. Build response format
        const emails = Array.from(new Set(allLinkedContacts.map((c: any) => c.email).filter((e: any) => e !== null))) as string[];
        const phoneNumbers = Array.from(new Set(allLinkedContacts.map((c: any) => c.phoneNumber).filter((p: any) => p !== null))) as string[];
        const secondaryContactIds = allLinkedContacts.filter((c: any) => c.id !== primaryContact.id).map((c: any) => c.id);

        // Ensure primary contact's details are first in the array
        if (primaryContact.email && emails[0] !== primaryContact.email) {
            emails.splice(emails.indexOf(primaryContact.email), 1);
            emails.unshift(primaryContact.email);
        }
        if (primaryContact.phoneNumber && phoneNumbers[0] !== primaryContact.phoneNumber) {
            phoneNumbers.splice(phoneNumbers.indexOf(primaryContact.phoneNumber), 1);
            phoneNumbers.unshift(primaryContact.phoneNumber);
        }

        res.status(200).json({
            contact: {
                primaryContactId: primaryContact.id,
                emails,
                phoneNumbers,
                secondaryContactIds,
            },
        });

    } catch (error) {
        console.error("Error in /identify:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

export default app;
