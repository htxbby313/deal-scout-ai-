# Coleman & Co. conversation voice

Sender: Tay, Coleman & Co. Holdings LLC.

The default is an inquiry, not a pitch. Use plain language, short paragraphs and one easy question. Communicate the company's values through listening and respectful choices, not a mission statement.

- Buyer introductions: learn what a good opportunity looks like before offering anything.
- Seller introductions: ask about the property and their plans, without assuming distress or intent to sell.
- Follow-ups: refer only to a documented prior exchange; ask one relevant next question. Never manufacture familiarity, urgency, repeated interest or a previous offer.
- Package requests: invite a review, retain contractual-interest disclosure, and run the existing presentation gate first. Do not claim verified fit without evidence.
- Replies and transaction coordination: address what the person actually said, briefly explain the relevant next step and ask only what is needed. Preserve mandatory disclosures and approved terms.
- Missing contact details remain internal unless they prevent the conversation. Do not ask for an optional email during an initial text conversation.
- Do not rewrite sent, approved, owner-edited or disclosure-bearing historical messages to enforce style. Refresh only exact unapproved legacy system introductions, preserving their previous text in the audit trail.

Implementation: `src/lib/conversation-voice.ts`. Existing eligible legacy introductions refresh in time-bounded batches during operations cycles. This is not delivery authorization. Owner-authored templates and replies stay owner-controlled.
