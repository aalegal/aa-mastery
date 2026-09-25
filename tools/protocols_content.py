"""
Review protocols for the six training matters.

Every coding rule here was derived from the matter's answer key, not written
from memory. The simulator grades all five fields on every document, so a rule
that disagrees with the key teaches reviewers to lose points. If you change a
rule, check it against the key first -- the cross-tabs that produced these are
described in the commit that introduced this file.

What does NOT belong here: any per-document answer. Rules and definitions only,
exactly as a real protocol would give them.
"""

# ── Shared ───────────────────────────────────────────────────────────────────

ESCALATION = [
    ("1", "Glory or Junior", "Your first go-to for every question."),
    ("2", "Zabron or Simon", "If Glory and Junior are unavailable or need backup."),
    ("3", "Aaron", "If it is still unclear after steps 1 and 2."),
    ("4", "PM / RM", "If Aaron has no clear answer, or the question is client-level."),
]

ESCALATION_NOTES = [
    "Never guess silently on a gray area. While you wait for an answer, protect the "
    "document: treat it as privileged and do not release it.",
    "Ask a good question: the document ID; short context (who is writing to whom, "
    "about what); your lean and why; and what makes it difficult.",
]

QC_STANDARD = [
    ("Accuracy", "Measured as defects per 1,000 documents. The target is zero. "
                 "One defect per thousand still scores 95."),
    ("Pace", "60 documents per hour, sustained, done properly."),
    ("Responsiveness", "Reply to supervisor messages within 2 minutes while on shift."),
    ("The rule that outranks the others", "Never trade privilege accuracy for speed."),
]

TRAINING_NOTE = ("Training matter. The parties, events and documents are fictional "
                 "and exist for AA Team review practice.")

# ── Coding schemes ───────────────────────────────────────────────────────────
# Two schemes with different vocabularies, one shared rule for what goes out:
# a document that is not responsive is withheld on every platform. (Relativity
# and Everlaw keys used to say Produce; they were changed to match real review
# and Casepoint, so reviewers build one habit.)

def scheme_relativity_everlaw(acp, acpwp, action_field, unused):
    """acp / acpwp: the platform's labels for the two privilege values."""
    return {
        "fields": [
            ("Responsiveness", "Responsive · Non-Responsive"),
            ("Privilege", "Not Privileged · %s · %s" % (acp, acpwp)),
            ("Issues", "Select every issue that applies"),
            (action_field, "Produce · Withhold"),
            ("Confidentiality", "Standard · Highly Confidential · Attorneys Eyes Only"),
        ],
        "head": ["If the document is…", "Responsiveness", "Privilege",
                 action_field, "Confidentiality"],
        "rows": [
            ["Not responsive to any request",
             "Non-Responsive", "Not Privileged", "Withhold", "Standard"],
            ["Responsive, with no legal advice in it",
             "Responsive", "Not Privileged", "Produce", "Highly Confidential or Standard (see 8)"],
            ["Responsive, and carries legal advice from counsel",
             "Responsive", acp, "Withhold", "Attorneys Eyes Only"],
            ["Responsive, and counsel's advice or analysis was prepared because of "
             "the investigation or litigation",
             "Responsive", acpwp, "Withhold", "Attorneys Eyes Only"],
        ],
        "notes": [
            "Anything that is not going out is withheld, so a non-responsive document is "
            "withheld just as a privileged one is. It is the same rule on every platform "
            "in the AA Team program.",
            "Issues go on responsive documents only. A non-responsive document never "
            "carries an issue.",
            "Every privileged document is withheld and designated Attorneys Eyes Only. "
            "No exceptions in this matter.",
            "%s are on the panel but are never the correct final call in this matter. "
            "If you are unsure, escalate (section 10); do not submit a placeholder." % unused,
        ],
        "conf": [
            ("Attorneys Eyes Only", "Every withheld privileged document."),
            ("Highly Confidential", "Non-public internal information whose disclosure "
             "would harm the company: internal executive and technical communications "
             "about the core events, engineering and trading internals, risk data, "
             "commercial and pricing strategy, HR and personnel matters."),
            ("Standard", "Government and regulator documents, routine recurring records, "
             "widely distributed material, and every non-responsive document."),
        ],
        "conf_note": ("These categories come from how the matter is graded. The call "
                      "follows the content: not the custodian, and not how many issues a "
                      "document hits."),
    }


def scheme_casepoint(priv_label, third_priv):
    """third_priv: (label, row) for the matter's third privilege value."""
    third_label, third_row = third_priv
    return {
        "fields": [
            ("Responsiveness", "Responsive · Not Responsive · Technical Issue"),
            ("Privilege", "Not Privileged · %s · %s" % (priv_label, third_label)),
            ("Issues", "Select every issue that applies"),
            ("Production", "Produce · Withhold · Redact"),
            ("Confidentiality", "Confidential · Highly Conf. – AEO"),
        ],
        "head": ["If the document is…", "Responsiveness", "Privilege",
                 "Production", "Confidentiality"],
        "rows": [
            ["A file that failed processing and cannot be read",
             "Technical Issue", "Not Privileged", "Withhold", "Confidential"],
            ["Not responsive to any request",
             "Not Responsive", "Not Privileged", "Withhold", "Confidential"],
            ["Responsive and privileged throughout",
             "Responsive", priv_label, "Withhold", "See 8"],
            third_row,
            ["Responsive, not privileged, but contains protected personal or "
             "sensitive information (see 9)",
             "Responsive", "Not Privileged", "Redact", "By content (see 8)"],
            ["Responsive, and none of the above",
             "Responsive", "Not Privileged", "Produce", "See 8"],
        ],
        "notes": [
            "Production means \"does this go out\". A document that is not responsive, "
            "or cannot be read, is withheld. It is the same rule on every platform in the "
            "AA Team program.",
            "Technical Issue: if a file failed processing, code it Technical Issue, "
            "withhold it and route it for re-collection. Never guess substantive coding "
            "for a document you cannot read.",
            "Issues go on responsive documents only. Hot Doc is tagged alongside the "
            "substantive issues, never instead of them.",
        ],
        "conf": [
            ("Highly Conf. – AEO", "Competitively or commercially sensitive material, "
             "and most privileged documents."),
            ("Confidential", "Everything else, including every Not Responsive and "
             "Technical Issue document, and ordinary business logistics."),
        ],
        "conf_note": ("These categories come from how the matter is graded. The call "
                      "follows the content, not who sent the document."),
    }

# ── The six matters ──────────────────────────────────────────────────────────

MATTERS = [

# 1 ─────────────────────────────────────────────────────────────────────────
{
    "file": "QuantumEdge-AI-Review-Protocol.pdf",
    "conf": [('Attorneys Eyes Only', 'Every withheld privileged document.'), ('Highly Confidential', "Internal technical and trading material about APEX: performance reports, stress tests, override reconstructions and production logs. What clients and investors were told about APEX's specifications. Investor loss claims and other evidence of damages. Internal communications about the crash."), ('Standard', 'Routine recurring records, such as the monthly code reviews. Government documents, such as the SEC Wells Notice. Every non-responsive document.')],
    "short": "SEC v. QuantumEdge AI",
    "title": "SEC v. QuantumEdge AI",
    "subtitle": "APEX Flash Crash · SEC, CFTC and DOJ investigation",
    "platform": "Relativity",
    "meta": [("Platform", "Relativity"), ("Documents", "500 · 498 emails, 2 memos"),
             ("Date range", "January 1, 2023 – December 28, 2024")],
    "overview": [
        "QuantumEdge AI's APEX trading algorithm entered a positive feedback loop on "
        "March 15, 2024, executing 847,000 sell orders in 23 minutes and causing a "
        "$4.7 billion decline in market capitalisation. The SEC, the CFTC and the DOJ "
        "are investigating securities fraud, market manipulation, insider trading and "
        "failure to supervise. A class action by 14,847 investors claims $2.1 billion.",
        "The documents were collected from QuantumEdge AI. Technical material needs "
        "careful reading: the question that runs through the whole matter is what the "
        "company KNEW against what it DISCLOSED.",
    ],
    "custodians": [
        ("CEO", "Nathan Brock"), ("CTO", "Dr. Yael Cohen"),
        ("General Counsel", "Rebecca Moss"), ("Chief Risk Officer", "Diane Abara"),
        ("Compliance Officer", "Kevin Nash"), ("Lead Engineer", "Sofia Reyes"),
    ],
    "scheme": scheme_relativity_everlaw(
        "ACP", "ACP + WPP", "Production Action",
        "Needs Review, Work Product on its own, Escalate, Redact and Review Later"),
    "issues": [
        ("1", "Securities Fraud",
         "False or misleading statements to investors about APEX's safety.",
         "Pitch decks and investor materials claiming working circuit breakers; the "
         "December 2023 report documenting the failure mode; kill-switch latency "
         "described inaccurately."),
        ("2", "Market Manipulation",
         "APEX's trading behaviour during the crash.",
         "The 847,000 sell orders, about 40% of market volume; the position-limit "
         "override; the feedback loop that produced artificial prices."),
        ("3", "Insider Trading",
         "The CEO's trading ahead of the crash.",
         "Applies narrowly: only documents bearing on the CEO's trades, or on what he "
         "knew before he made them (see the alert below)."),
        ("4", "Failure to Supervise",
         "Inadequate controls over the algorithm.",
         "The known circuit-breaker defect; the undocumented position-limit override; "
         "a kill switch overwhelmed at live trading speed."),
    ],
    "privilege": [
        "Privilege requires legal advice from counsel. A lawyer's name on a document "
        "does not make it privileged.",
        "Engineering reports and internal memos are business documents. Not privileged.",
        "Forensic trading logs are factual records. Not privileged.",
        "Government documents, such as the SEC Wells Notice, are never privileged.",
        "The Wells Submission and SEC response strategy memos are ACP + WPP.",
        "Use ACP for advice given in the ordinary course, and ACP + WPP when counsel's "
        "advice or analysis was prepared because of the investigation. Most privileged "
        "documents in this matter are ACP + WPP.",
    ],
    "screen": [
        ("Rebecca Moss", "General Counsel, QuantumEdge AI", "In-house"),
        ("Amy Park", "Outside counsel", "Skadden · skadden.com"),
        ("Carl Stein", "Criminal defense attorney", "steinlaw.com"),
    ],
    "redaction": None,
    "alerts": [
        ("Insider trading timeline",
         "Any document showing what the CEO knew before March 12 (the trade date) is "
         "critical for Issue 3. Reconstruct the sequence from the documents: March 8, "
         "the CRO's risk warning; March 8, the CEO dismisses it; March 12, the CEO "
         "sells $6 million of stock and buys put options; March 15, the crash. The puts "
         "returned $4.8 million."),
    ],
},

# 2 ─────────────────────────────────────────────────────────────────────────
{
    "file": "VeridianBank-GDPR-Review-Protocol.pdf",
    "conf": [('Attorneys Eyes Only', 'Every withheld privileged document.'), ('Highly Confidential', 'Internal deliberation during the notification delay, including draft notifications. The review of biometric data retention. Personnel records about the CISO, such as performance reviews and advice on her termination. Internal communications that show what the bank knew.'), ('Standard', 'Security assessments, access-control audits and infrastructure remediation records. Notification status updates and DSAR figures. Scheduling and correspondence with the ICO and other regulators. Every non-responsive document.')],
    "short": "VeridianBank European Data Breach",
    "title": "VeridianBank European Data Breach",
    "subtitle": "Biometric and financial data breach · ICO, CNIL and BaFin enforcement",
    "platform": "Everlaw",
    "meta": [("Platform", "Everlaw"),
             ("Documents", "510 · 497 emails, 7 memos, 4 attachments, 2 contracts"),
             ("Date range", "January 10, 2021 – December 26, 2024")],
    "overview": [
        "VeridianBank PLC suffered a breach of 4.2 million customer records, including "
        "biometric authentication templates, financial data and health-linked "
        "transaction data. Three European regulators are investigating: the ICO (UK), "
        "the CNIL (France) and BaFin (Germany). A class action on behalf of up to 4.2 "
        "million data subjects is pending.",
        "Everlaw's coding fields differ from Relativity's, and privilege is labelled in "
        "UK terms. Learn the GDPR issue tags before you start.",
    ],
    "custodians": [
        ("CEO", "Edmund Walsh"), ("CISO", "Priya Sharma"),
        ("General Counsel", "Harriet Okafor"), ("CTO", "Marcus Bell"),
        ("CHRO", "Sandra Fox"), ("Data Protection Officer", "Kemi Ade"),
        ("Regulator correspondence", "ICO incident team"),
    ],
    "scheme": scheme_relativity_everlaw(
        "LPP (ACP)", "LPP + WP", "Action", "Escalate and Redact"),
    "issues": [
        ("1", "Art.32 Security Failure",
         "Inadequate technical and organisational security measures.",
         "Biometric data stored in plaintext; the vendor MFA gap; penetration-test "
         "findings left unremediated."),
        ("2", "Art.33/34 Notification",
         "Late or inadequate breach notification.",
         "The 72-hour clock starting at 01:14 AM; the CEO's instruction to delay; "
         "notification at 112 to 125 hours; misleading Art. 34 language to data subjects."),
        ("3", "Art.9 Special Data",
         "Special-category data and the higher protection it requires.",
         "The 4.2 million biometric templates; the 341,000 health-linked records."),
        ("4", "Whistleblower PIDA",
         "Retaliation against the CISO.",
         "The CISO's termination 7 days after her ICO submission; the performance plan "
         "opened the week of the breach; the PIDA claim."),
    ],
    "privilege": [
        "UK legal professional privilege (LPP) is the equivalent of attorney-client "
        "privilege. Counsel's advice on GDPR compliance strategy is LPP (ACP).",
        "Use LPP + WP when counsel's advice or analysis was prepared because of the "
        "regulatory investigation or the litigation.",
        "GDPR Art. 38 requires the DPO to be independent. Communications to or from the "
        "DPO may not be privileged: judge them by whether counsel's legal advice is "
        "being sought or given.",
        "Regulator correspondence (ICO, CNIL, BaFin) is never privileged.",
    ],
    "screen": [
        ("Harriet Okafor", "General Counsel, VeridianBank", "In-house"),
        ("James Vickers", "Partner", "Allen & Overy LLP · allenandovery.com"),
        ("Employment Team", "Outside counsel", "Allen & Overy LLP"),
    ],
    "redaction": None,
    "alerts": [
        ("Special category data",
         "Any document containing biometric template data, health data or genetic data "
         "is Art. 9 special-category data. Apply heightened protection, and code it "
         "Issue 3 as well as any other issue that applies."),
    ],
},

# 3 ─────────────────────────────────────────────────────────────────────────
{
    "file": "NorthStar-Meridian-Review-Protocol.pdf",
    "conf": [('Highly Conf. – AEO', 'Pricing and bidding strategy; customer-specific pricing; market-share analyses and competitive intelligence; deal rationale and integration planning; hot documents. Among privileged documents: advice from outside counsel, and attorney work product.'), ('Confidential', "Ordinary-course operational reports. Logistics and administration, including the General Counsel's. Any document redacted for employee personal information, even when it concerns integration planning. Documents with a privileged passage redacted. In-house counsel's privileged advice. Every Not Responsive and Technical Issue document.")],
    "short": "NorthStar / Meridian Merger Review",
    "title": "NorthStar / Meridian Merger Review",
    "subtitle": "DOJ Antitrust Division · HSR Second Request",
    "platform": "Casepoint",
    "meta": [("Platform", "Casepoint"), ("Documents", "415 · 282 emails, 92 memos, 41 files"),
             ("Date range", "November 1, 2023 – May 28, 2024")],
    "overview": [
        "NorthStar Logistics has agreed to acquire Meridian Freight. The DOJ Antitrust "
        "Division has issued a Second Request under the Hart-Scott-Rodino Act, "
        "requiring NorthStar to produce documents bearing on the deal's effect on "
        "competition. We are reviewing NorthStar's documents for that production.",
        "The DOJ's question is whether the merger lessens competition. Read every "
        "document for what it says about pricing, competitors and why NorthStar wants "
        "the deal.",
    ],
    "custodians": [
        ("CEO", "Daniel Reyes"), ("CFO", "Karen Whitfield"),
        ("General Counsel", "Monica Feld"), ("COO", "Priya Nadkarni"),
        ("Strategy", "Alan Pierce"), ("VP Sales", "Tom Bachová"),
        ("Finance Director", "Greg Tanaka"),
        ("Also collected", "HR, Operations and Marketing mailboxes"),
    ],
    "scheme": scheme_casepoint("Privileged", ("Redact (Privilege)", [
        "Responsive, with a privileged passage inside ordinary business content",
        "Responsive", "Redact (Privilege)", "Redact", "Confidential"])),
    "issues": [
        ("1", "Pricing/Bidding",
         "Pricing, rates and bids.",
         "Rate changes, customer pricing, bid strategy, and any coordination of bids "
         "around the deal."),
        ("2", "Market Share",
         "The competitive landscape.",
         "Market shares, named competitors, lanes and corridors where the two companies "
         "compete."),
        ("3", "Merger Rationale",
         "Why NorthStar wants Meridian.",
         "Deal terms, synergies, integration planning, and statements of purpose."),
        ("4", "Hot Doc",
         "Documents central to the DOJ's theory of harm.",
         "For example, a document tying the deal to removing a competitor or raising "
         "prices. Tag alongside the substantive issues."),
    ],
    "privilege": [
        "Privileged means legal advice from General Counsel Monica Feld or from outside "
        "counsel at Harlan Crowe.",
        "A lawyer's title does not make a document privileged. An email from the General "
        "Counsel about booking a room or ordering lunch carries no legal advice and is "
        "not privileged.",
        "Mixed documents: when a paragraph relaying counsel's advice sits inside ordinary "
        "business content, redact that paragraph and produce the rest. Code Privilege as "
        "Redact (Privilege) and Production as Redact.",
    ],
    "screen": [
        ("Monica Feld", "General Counsel, NorthStar Logistics", "In-house"),
        ("Harlan Crowe", "Outside counsel to NorthStar", "harlancrowe.com"),
    ],
    "redaction": [
        "Employee personal information (Social Security numbers, home addresses) must be "
        "redacted before production. The document stays Not Privileged; Production is "
        "Redact; Confidentiality is Confidential.",
        "Privileged passages are redacted with Privilege set to Redact (Privilege), as "
        "described in section 7.",
    ],
    "alerts": [
        ("Highly Conf. – AEO in a merger review",
         "Pricing strategy, bid strategy and merger rationale are competitively "
         "sensitive: a competitor seeing them could use them. Designate those Highly "
         "Conf. – AEO. Routine logistics and administration are Confidential."),
    ],
},

# 4 ─────────────────────────────────────────────────────────────────────────
{
    "file": "St-Aurelius-Breach-Review-Protocol.pdf",
    "conf": [('Highly Conf. – AEO', "Sensitive business information: internal discussion of financial exposure, costs and insurance, and the ransom terms. Among privileged documents: forensic work performed at outside counsel's direction."), ('Confidential', 'Everything else: patient complaints and HR records once redacted, security correspondence, notification logistics, incident-response status updates, vendor invoices, PR material, other privileged communications, and every Not Responsive and Technical Issue document.')],
    "short": "Doe v. St. Aurelius Health System",
    "title": "Doe v. St. Aurelius Health System",
    "subtitle": "CryptVault ransomware breach · HHS OCR investigation and class action",
    "platform": "Casepoint",
    "meta": [("Platform", "Casepoint"), ("Documents", "400 · 282 emails, 33 memos, 85 files"),
             ("Date range", "January 21, 2025 – June 28, 2025")],
    "overview": [
        "A CryptVault ransomware attack on St. Aurelius Health System exposed "
        "approximately 2.1 million patient records. The HHS Office for Civil Rights is "
        "investigating under HIPAA, and patients have filed a class action. We are "
        "reviewing St. Aurelius's documents for production.",
        "This matter is redaction-heavy. Patient and employee information must come out "
        "before anything is produced, and the click-to-redact tool is part of the "
        "exercise.",
    ],
    "custodians": [
        ("CEO", "Robert Ellison"), ("CISO", "Priya Raman"),
        ("General Counsel", "Diane Okafor"), ("IT Director", "Marcus Webb"),
        ("Finance Director", "Tom Okonkwo"),
        ("Also collected", "HR and the Patient Privacy Office"),
    ],
    "scheme": scheme_casepoint("Privileged", ("Redact (Privilege)", [
        "Responsive, with a privileged passage inside ordinary business content",
        "Responsive", "Redact (Privilege)", "Redact", "Confidential"])),
    "issues": [
        ("1", "Security Failures",
         "The control gaps that let the attackers in.",
         "Patching, MFA, network segmentation, known vulnerabilities left open."),
        ("2", "Timeline & Notification",
         "When the breach was found, and when patients and HHS were told.",
         "Discovery dates, notification decisions, patient complaints about notice."),
        ("3", "Incident Response",
         "What St. Aurelius did once it knew.",
         "Containment, forensics, ransom negotiation, recovery, staffing, cost."),
        ("4", "Hot Doc",
         "Documents especially damaging to St. Aurelius.",
         "Tag alongside the substantive issues."),
    ],
    "privilege": [
        "Privileged means legal advice from General Counsel Diane Okafor or from outside "
        "counsel at Whitmore Gray.",
        "Communications with the threat actor, including the ransom negotiation, are "
        "never privileged.",
    ],
    "screen": [
        ("Diane Okafor", "General Counsel, St. Aurelius", "In-house"),
        ("Whitmore Gray", "Outside counsel", "whitmoregray.com"),
        ("Sentinel Forensics", "Forensic firm retained BY outside counsel",
         "sentinelforensics.com"),
    ],
    "redaction": [
        "PII: Social Security numbers, home addresses, dates of birth.",
        "PHI: medical details, diagnoses and treatment information.",
        "SBI (sensitive business information): cost estimates, insurance posture, "
        "ransom terms.",
        "Not protected, so leave them visible: job titles and department names.",
        "Redact, then produce: Production is Redact and Privilege stays Not Privileged. "
        "Designate Highly Conf. – AEO when the redacted content is sensitive business "
        "information; otherwise Confidential.",
    ],
    "alerts": [
        ("Who directed the forensics decides privilege",
         "Forensic work performed by Sentinel Forensics at outside counsel's direction, "
         "in anticipation of litigation, is protected work product (the Kovel line of "
         "cases). The same technical content prepared without counsel's direction is not "
         "protected. Before you code a forensic document, check who retained and "
         "directed the work."),
    ],
},

# 5 ─────────────────────────────────────────────────────────────────────────
{
    "file": "Cascade-Headwaters-Review-Protocol.pdf",
    "conf": [('Highly Conf. – AEO', 'Every document coded First Am. — Flag & Escalate, and every privileged document.'), ('Confidential', 'Every other responsive document, including published advocacy material, operational monitoring and incident records, and vendor invoices. Every Not Responsive and Technical Issue document.')],
    "short": "TransRidge v. Cascade Headwaters",
    "title": "TransRidge Pipeline LLC v. Cascade Headwaters Alliance",
    "subtitle": "Pipeline protest discovery · First Amendment associational privilege",
    "platform": "Casepoint",
    "meta": [("Platform", "Casepoint"), ("Documents", "500 · 294 emails, 53 memos, 153 files"),
             ("Date range", "September 1, 2024 – June 28, 2025")],
    "overview": [
        "TransRidge Pipeline LLC has sued Cascade Headwaters Alliance, an advocacy group "
        "that organised protests against its pipeline, and served discovery requests "
        "seeking the Alliance's members and donors, its protest strategy, and evidence "
        "of trespass and property damage. We represent the Alliance.",
        "The First Amendment protects the freedom to associate, and forcing a group to "
        "name its members or donors can chill it (NAACP v. Alabama). That protection is "
        "qualified: a court weighs it against TransRidge's need for the material. "
        "Reviewers do not make that call. You flag it.",
    ],
    "custodians": [
        ("Executive Director", "Maya Reyes"), ("Organizing Director", "Ben Calloway"),
        ("Development Director", "Priya Nair"), ("Volunteer Coordinator", "Sam Otieno"),
        ("Operations Manager", "Dana Whitfield"),
    ],
    "scheme": scheme_casepoint("Privileged (A-C)", ("First Am. — Flag & Escalate", [
        "Responsive, and identifies members or donors, or reveals internal organizing "
        "and advocacy strategy",
        "Responsive", "First Am. — Flag & Escalate", "Withhold", "Highly Conf. – AEO"])),
    "issues": [
        ("1", "Membership & Donors",
         "Who the Alliance's members, donors and volunteers are.",
         "Membership rosters, donor lists, contribution records, anything naming an "
         "individual rank-and-file member."),
        ("2", "Protest Strategy",
         "How the Alliance plans and runs its campaign.",
         "Organizing plans, targets, tactics, volunteer assignments, messaging."),
        ("3", "Trespass / Property Damage",
         "Events at pipeline sites.",
         "Alleged trespass or damage, who was present, what happened."),
        ("4", "Hot Doc",
         "Documents of particular significance to TransRidge's claims.",
         "Tag alongside the substantive issues."),
    ],
    "privilege": [
        "Two different protections apply, and the panel keeps them apart. Privileged "
        "(A-C) is ordinary attorney-client privilege: legal advice from Rivera Stone.",
        "First Am. — Flag & Escalate is for the associational privilege: documents that "
        "identify members or donors, or reveal internal organizing and advocacy "
        "strategy. Withhold them and designate Highly Conf. – AEO.",
        "Never assume the First Amendment privilege applies, and never assume it does "
        "not. Flag it and let it be decided.",
        "Outside counsel's advice to the Alliance about how to conduct this review is "
        "privileged but not itself responsive to TransRidge's requests: code it Not "
        "Responsive and Privileged (A-C), withhold it, and designate Highly Conf. – AEO.",
        "Content controls responsiveness, not the mailbox. A personal message sent from "
        "a work account is not responsive.",
    ],
    "screen": [
        ("Rivera Stone", "Outside counsel to the Alliance", "riverastone.com"),
    ],
    "redaction": [
        "Redaction is rare in this matter. Material the First Amendment may protect is "
        "flagged and withheld whole rather than redacted.",
    ],
    "alerts": [
        ("Qualified privilege: flag, don't assume",
         "The associational privilege is qualified, not absolute. Your job is to "
         "recognise material it may cover and flag it, not to decide the balance. When a "
         "document names individual members or donors, or lays out internal strategy, "
         "code First Am. — Flag & Escalate and withhold."),
    ],
},

# 6 ─────────────────────────────────────────────────────────────────────────
{
    "file": "CADE-TechBrasil-Review-Protocol.pdf",
    "conf": [('Attorneys Eyes Only', 'Every withheld privileged document.'), ('Highly Confidential', 'Pricing coordination, bid-rigging and exchanges of competitor data. Board approvals of pricing. Trade secrets, such as technology roadmaps. Attempts to destroy evidence.'), ('Standard', "CADE's own requests and other regulatory correspondence. LGPD personal-data incident records. Whistleblower complaints. Every non-responsive document.")],
    "short": "CADE v. TechBrasil Consortium",
    "title": "CADE v. TechBrasil Consortium",
    "subtitle": "Brazilian antitrust · Lei 12.529/2011 · Portuguese-language review",
    "platform": "Everlaw",
    "meta": [("Platform", "Everlaw"), ("Documents", "500 · Brazilian Portuguese"),
             ("Date range", "January 3, 2021 – December 28, 2022")],
    "overview": [
        "Brazil's competition authority, CADE (Conselho Administrativo de Defesa "
        "Econômica), opened Administrative Process No. 08700.004521/2022-31 against "
        "TechBrasil SA and three alleged co-conspirators, Nexatel Ltda, DataComm Brasil "
        "and SulTech Sistemas, for a price-fixing cartel, market allocation, bid-rigging "
        "on government contracts and related violations of Lei 12.529/2011. TechBrasil "
        "SA is our client, and we are defending it. A leniency agreement negotiation is "
        "under way.",
        "The documents are in Brazilian Portuguese; this protocol is in English. Use "
        "translation tools for unfamiliar terms. Key terms are glossed below.",
    ],
    "custodians": [
        ("TechBrasil SA · our client", "CEO Ricardo Almeida, CFO Mariana Costa, "
         "GC Dr. Paulo Ferreira, CTO Fernanda Lima, Dir. Comercial Henrique Nobre, "
         "Dir. Gov. Affairs Claudia Ramos"),
        ("Nexatel Ltda · co-conspirator, leniency applicant", "CEO Rodrigo Vaz"),
        ("DataComm Brasil · co-conspirator", "Dir. André Santos"),
        ("CADE · competition authority", "Superintendência-Geral"),
    ],
    "scheme": scheme_relativity_everlaw(
        "LPP (ACP)", "LPP + WP", "Action", "Escalate and Redact"),
    "issues": [
        ("1", "Fixação de Preços", "Price fixing",
         "Horizontal agreement between competitors to fix, raise or stabilise prices "
         "(Art. 36 §3 I)."),
        ("2", "Divisão de Mercado", "Market allocation",
         "Agreement to divide customers, territories or products between competitors."),
        ("3", "Fraude em Licitação", "Bid rigging",
         "Coordinated manipulation of competitive bidding, especially government "
         "tenders (pregões, licitações)."),
        ("4", "Troca de Informações", "Information exchange",
         "Sharing competitively sensitive information (prices, costs, customers) with "
         "competitors."),
        ("5", "Coord. de Cartel", "Cartel coordination",
         "General cartel organisation, meetings and implementation of collusive "
         "agreements."),
        ("6", "Abuso Posição Dom.", "Abuse of dominance",
         "Abuse of a dominant market position (Art. 36 §2)."),
        ("7", "Fraude Contratos Pub.", "Government contract fraud",
         "Fraud on public procurement (Lei 8.666/93 and Lei 12.529)."),
        ("8", "Acordo de Leniência", "Leniency agreement",
         "Documents about CADE leniency negotiations (Art. 86). See the alert below."),
        ("9", "Priv. Adv.-Cliente", "Attorney-client privilege",
         "Tag EVERY privileged document with this issue, and nothing else. See section 7."),
        ("10", "Produto Jurídico", "Work product",
         "Only legal analysis authored by counsel. See section 7."),
        ("11", "Corresp. Regulatória", "Regulatory correspondence",
         "Correspondence with CADE, ANATEL, ANPD or other Brazilian regulators."),
        ("12", "Conf. Terceiros", "Third-party confidential",
         "Confidential information belonging to clients or suppliers."),
        ("13", "Dados LGPD", "Personal data (LGPD)",
         "Personal data subject to Brazil's data protection law, the LGPD."),
        ("14", "Segredo Comercial", "Trade secret",
         "Proprietary business information: pricing models, customer data, technology "
         "roadmaps."),
        ("15", "Whistleblower", "Whistleblower protection",
         "Internal or regulatory whistleblower disclosures."),
        ("16", "Resp. Diretores", "Director liability",
         "Personal liability of individual directors and officers (Art. 37)."),
        ("17", "Gun-Jumping", "Gun-jumping",
         "Implementing a merger before CADE approval (Art. 88)."),
        ("18", "Obstrução", "Obstruction",
         "Destruction or concealment of evidence (Art. 340 Código Penal and CADE "
         "sanctions)."),
    ],
    "issue_head": ["#", "Tag (PT)", "English", "Definition"],
    "privilege": [
        "Brazil recognises attorney-client privilege (sigilo profissional) under the OAB "
        "Statute, Art. 7. Communications with in-house counsel (advogado empregado) may "
        "receive less protection than those with outside counsel.",
        "CADE can compel documents notwithstanding a privilege claim. Flag every "
        "potentially privileged document for senior review.",
        "Issue 9 rule: every privileged document, LPP (ACP) or LPP + WP, is also tagged "
        "Issue 9. No other document is.",
        "Issue 10 rule: tag Issue 10 only for legal analysis written by counsel, such as "
        "a strategy memo or a liability analysis. A business-side update ABOUT a "
        "privileged matter can be LPP + WP without being counsel's work product; it does "
        "not get Issue 10.",
    ],
    "screen": [
        ("Dr. Paulo Ferreira", "General Counsel, TechBrasil", "In-house (advogado empregado)"),
        ("Dr. Marcos Teixeira", "Sócio externo (external partner)",
         "teixeiralaw.com.br"),
    ],
    "redaction": None,
    "alerts": [
        ("Leniency",
         "Documents about the leniency negotiation (Issue 8) are highly sensitive and "
         "may need separate privilege logging. Do not code them Produce without senior "
         "attorney review."),
        ("Language guidance",
         "pregão = government e-auction · licitação = government tender · cartel = cartel · "
         "reajuste = price adjustment · alinhamento = alignment (a cartel term for "
         "coordination) · leniência = leniency · processo administrativo = "
         "administrative proceeding"),
    ],
},

]
