"""
Generate cir-docs.js -- the Larkspur Benefit Services document set for the
Cyber Incident Response matter.

    python3 tools/build_cir_docs.py

Deterministic: a fixed seed produces the same 150 documents every run. Refuses
to write the file if the set fails any of its checks.

Every name, number and address is fictional. SSNs use area 900-999 with group
00, a combination never issued as an SSN or an ITIN. Phone numbers use the
reserved 555-01xx range; emails use example.com; card numbers are published
test numbers.
"""
import json
import os
import random
import re
import sys
from collections import Counter

SEED = 20260925
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "cir-docs.js")
rng = random.Random(SEED)

KIND_COUNTS = {"roster": 20, "claim": 25, "visit-note": 15, "w2": 10, "direct-deposit": 10, "i9": 8,
               "email": 22, "policy": 10, "it-ticket": 10, "marketing": 10, "meeting-notes": 10}
NO_PII_KINDS = {"policy", "it-ticket", "marketing", "meeting-notes"}
TRAP_MINIMUMS = {"page-break": 8, "duplicate-person": 3, "masked-ssn": 12, "provider": 40,
                 "unnamed-ssn": 3, "name-only": 2, "business-contact": 30, "dependent": 30}
EL_KEYS = ["ssn", "dl", "passport", "fin", "card", "login", "bio", "mrn", "plan", "med"]
NO_PII_PATTERNS = [r"\b\d{3}-\d{2}-\d{4}\b", r"MRN-\d", r"LKS\d{9}", r"WDL[A-Z0-9]{9}",
                   r"Routing number", r"Account number", r"\b\d{4} \d{4} \d{4} \d{4}\b",
                   r"(?i)password", r"FP-\d"]

FIRST = ["Ana", "David", "Lily", "Grace", "Marcus", "Priya", "Tomas", "Hannah", "Kevin", "Rosa",
         "Samuel", "Irene", "Owen", "Fatima", "Caleb", "Mei", "Victor", "Nora", "Isaac", "Leah",
         "Andre", "Julia", "Felix", "Amara", "Ethan", "Sofia", "Gabriel", "Chloe", "Ruben", "Maya",
         "Elliot", "Zara", "Hugo", "Ingrid", "Jonah", "Keira", "Luis", "Mira", "Nikhil", "Olga",
         "Pablo", "Quinn", "Rhea", "Stefan", "Talia", "Uma", "Wes", "Yara", "Aiden", "Bianca",
         "Colin", "Dara", "Emil", "Farah", "Gideon", "Hazel", "Ivan", "Jade", "Kofi", "Lena"]
LAST = ["Rivera", "Okafor", "Chen", "Holloway", "Lindqvist", "Nakamura", "Haddad", "Brennan", "Castillo", "Duarte",
        "Ellison", "Fitzgerald", "Garrow", "Hanley", "Ibarra", "Jansen", "Kowalski", "Larkin", "Mendel", "Novak",
        "Osei", "Pruitt", "Quiroga", "Ramsay", "Sandoval", "Thorne", "Underwood", "Vasko", "Whitlock", "Yamada",
        "Abernathy", "Bellamy", "Crowder", "Delacroix", "Easton", "Faraday", "Gallo", "Hendricks", "Iverson", "Joyner",
        "Kimura", "Lachance", "Moreau", "Nightingale", "Ostrowski", "Pemberton", "Rasmussen", "Sokolov", "Tennant", "Valdez",
        "Wexler", "Albright", "Barros", "Cordova", "Dunleavy", "Espinoza", "Fairbanks", "Gustafson", "Hargrove", "Ishikawa"]
STREETS = ["Alder Ct", "Birch Ln", "Quarry Rd", "Cedar Ave", "Juniper St", "Madrona Dr", "Sequoia Pl", "Hemlock Way",
           "Willow Ter", "Aspen Cir", "Larch Blvd", "Maple Pkwy", "Spruce St", "Hawthorn Ave", "Dogwood Ln",
           "Sycamore Rd", "Fircrest Dr", "Tamarack Ct", "Laurel St", "Elderberry Way", "Chinook Ave",
           "Salmonberry Ln", "Ridgeview Dr", "Harbor Point Rd"]
CITIES = [("Tacoma", "WA", "98402"), ("Olympia", "WA", "98501"), ("Lakewood", "WA", "98499"),
          ("Puyallup", "WA", "98371"), ("Federal Way", "WA", "98003"), ("Kent", "WA", "98030"),
          ("Renton", "WA", "98057"), ("Auburn", "WA", "98002"), ("Gig Harbor", "WA", "98335"),
          ("Bremerton", "WA", "98312"), ("Vancouver", "WA", "98660"), ("Portland", "OR", "97205"),
          ("Salem", "OR", "97301"), ("Boise", "ID", "83702")]
EMPLOYERS = ["Cascade Valley Schools", "Rainier Logistics", "Sound Harbor Foods", "Evergreen Dental Group",
             "Pinecrest Manufacturing"]
DIAGNOSES = [("E11.9", "Type 2 diabetes mellitus without complications"), ("I10", "Essential (primary) hypertension"),
             ("F41.1", "Generalized anxiety disorder"), ("J45.909", "Unspecified asthma, uncomplicated"),
             ("M54.50", "Low back pain, unspecified"), ("E78.5", "Hyperlipidemia, unspecified"),
             ("K21.9", "Gastro-esophageal reflux disease without esophagitis"), ("F32.A", "Depression, unspecified"),
             ("G43.909", "Migraine, unspecified"), ("N39.0", "Urinary tract infection, site not specified")]
MEDS = ["metformin 500 mg twice daily", "lisinopril 10 mg daily", "sertraline 50 mg daily",
        "albuterol inhaler as needed", "atorvastatin 20 mg nightly", "omeprazole 20 mg daily",
        "sumatriptan 50 mg as needed", "nitrofurantoin 100 mg for 5 days"]
PROVIDERS = [("Meera", "Patel", "MD"), ("Samuel", "Okonjo", "DO"), ("Helen", "Marchetti", "MD"),
             ("Arjun", "Rao", "MD"), ("Claire", "Dubois", "NP"), ("Martin", "Szabo", "MD"),
             ("Yusuf", "Karimi", "PA-C"), ("Beatrice", "Lowell", "MD")]
STAFF = [("Jordan", "Pike", "Benefits Specialist"), ("Morgan", "Tate", "Payroll Coordinator"),
         ("Riley", "Vance", "IT Service Desk"), ("Casey", "Holt", "Claims Analyst"),
         ("Avery", "Nash", "Finance Manager"), ("Drew", "Keller", "HR Generalist")]
TEST_CARDS = ["4111 1111 1111 1111", "5555 5555 5555 4444", "3782 822463 10005"]
MONTHS = ["January", "February", "March", "April", "May", "June"]

used = set()


def digits(n):
    return "".join(rng.choice("0123456789") for _ in range(n))


def ssn():
    return "%d-00-%s" % (rng.randint(900, 999), digits(4))


def masked_ssn():
    return "XXX-XX-" + digits(4)


def member_id():
    return "LKS" + digits(9)


def mrn():
    return "MRN-" + digits(8)


def dl_number():
    return "WDL" + "".join(rng.choice("ABCDEFGHJKLMNPRSTUVWXYZ0123456789") for _ in range(9))


def passport_number():
    return "5" + digits(8)


def phone():
    return "(253) 555-01" + digits(2)


def work_email(first, last):
    return "%s.%s@larkspur.example.com" % (first.lower(), last.lower())


def doc_date():
    return "%s %d, 2025" % (rng.choice(MONTHS), rng.randint(1, 28))


def new_person(minor=False, last=None, address_of=None):
    for _ in range(2000):
        first = rng.choice(FIRST)
        surname = last or rng.choice(LAST)
        if (first, surname) not in used:
            break
    else:
        sys.exit("ran out of unique names")
    used.add((first, surname))
    year = rng.randint(2008, 2019) if minor else rng.randint(1950, 2001)
    dob = "%02d/%02d/%04d" % (rng.randint(1, 12), rng.randint(1, 28), year)
    if address_of:
        street, city, state, zipc = (address_of[k] for k in ("street", "city", "state", "zip"))
    else:
        city, state, zipc = rng.choice(CITIES)
        street = "%d %s" % (rng.randint(10, 9899), rng.choice(STREETS))
    return {"first": first, "last": surname, "dob": dob, "street": street,
            "city": city, "state": state, "zip": zipc}


def affected(p, elements, why, why_not=None):
    person = dict(p)
    person["el"] = {k: (k in elements) for k in EL_KEYS}
    person["why"] = why
    if why_not:
        person["whyNot"] = why_not
    return person


def without(p, *fields):
    q = dict(p)
    for f in fields:
        q[f] = ""
    return q


ADDRESS = ("street", "city", "state", "zip")


def table_text(caption, columns, rows, page_break):
    lines = [caption, " | ".join(columns)]
    for i, r in enumerate(rows):
        if page_break is not None and i == page_break:
            lines.append("--- Page 2 ---")
        lines.append(" | ".join(r))
    return "\n".join(lines)


def form_text(heading, sections):
    lines = [heading]
    for s in sections:
        lines.append(s["label"])
        lines += ["%s: %s" % (a, b) for a, b in s["fields"]]
    return "\n".join(lines)


def email_text(e):
    return "From: %s\nTo: %s\nSubject: %s\n\n%s" % (e["from"], e["to"], e["subject"], e["body"])


def doc(kind, custodian, subject, content_key, content, body, people,
        not_people=None, traps=None, why=None, frm=""):
    d = {"type": kind, "custodian": custodian, "subject": subject, "date": doc_date(),
         "from": frm, "hasAttachment": False, content_key: content, "body": body,
         "answer": {"noPii": not people, "people": people}, "traps": traps or []}
    if not_people:
        d["answer"]["notPeople"] = not_people
    if why:
        d["answer"]["why"] = why
    return d


# ── Documents with PII ───────────────────────────────────────────────────────

def roster(dup=False):
    employer = rng.choice(EMPLOYERS)
    with_ssn = rng.random() < 0.5
    cols = ["Member ID", "Last Name", "First Name", "DOB"] + (["SSN"] if with_ssn else []) + \
           ["Relationship", "Street", "City", "State", "ZIP"]
    target = rng.randint(10, 40)
    rows, members, traps = [], [], []
    while len(members) < target:
        emp = new_person()
        household = [(emp, "Employee")]
        if rng.random() < 0.55:
            household.append((new_person(last=emp["last"], address_of=emp), "Spouse"))
        for _ in range(rng.choice([0, 0, 1, 1, 2, 3])):
            household.append((new_person(minor=True, last=emp["last"], address_of=emp), "Child"))
        for p, rel in household[:target - len(members)]:
            rows.append([member_id(), p["last"], p["first"], p["dob"]] + ([ssn()] if with_ssn else []) +
                        [rel, p["street"], p["city"], p["state"], p["zip"]])
            members.append((p, rel))
            if rel == "Child":
                traps.append("dependent")
    page_break = None
    if len(rows) >= 14:
        page_break = len(rows) - rng.randint(1, 4)
        traps.append("page-break")
    dup_index = None
    if dup:
        dup_index = rng.randrange(len(rows))
        rows.append(list(rows[dup_index]))
        traps.append("duplicate-person")
    people = []
    for i, (p, rel) in enumerate(members):
        where = "Row %d of the census" % (i + 1)
        if page_break is not None and i >= page_break:
            where += ", below the page break on page 2"
        if rel == "Child":
            where += "; a dependent, and still an affected individual"
        if i == dup_index:
            where += "; listed twice after a coverage change, so it is one row"
        why = {"person": where + ".", "plan": "Member ID on the census row."}
        if with_ssn:
            why["ssn"] = "SSN column on the census row."
        people.append(affected(p, {"plan"} | ({"ssn"} if with_ssn else set()), why))
    caption = "%s: plan year 2025 enrollment census%s" % (
        employer, " (includes a re-listed coverage change)" if dup else "")
    return doc("roster", "cust-benefits", "Enrollment census: " + employer, "table",
               {"caption": caption, "columns": cols, "rows": rows, "pageBreakBefore": page_break},
               table_text(caption, cols, rows, page_break), people, traps=traps)


def claim():
    p = new_person()
    prov = rng.choice(PROVIDERS)
    pc, ps, pz = rng.choice(CITIES)
    prov_addr = "%d %s, Suite %d, %s, %s %s" % (rng.randint(100, 4000), rng.choice(STREETS),
                                                rng.randint(100, 400), pc, ps, pz)
    dx = rng.sample(DIAGNOSES, rng.choice([1, 2]))
    sections = [
        {"label": "Patient", "fields": [
            ["Patient name", "%s, %s" % (p["last"], p["first"])], ["Date of birth", p["dob"]],
            ["Address", p["street"]], ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])],
            ["Member ID", member_id()]]},
        {"label": "Rendering provider", "fields": [
            ["Provider", "Dr. %s %s, %s" % prov], ["Practice address", prov_addr],
            ["Phone", phone()], ["NPI", digits(10)]]},
        {"label": "Diagnosis (ICD-10)", "fields": [[code, desc] for code, desc in dx]},
        {"label": "Service", "fields": [
            ["Date of service", "%02d/%02d/2025" % (rng.randint(1, 5), rng.randint(1, 28))],
            ["Billed", "$%d.00" % rng.randint(90, 2400)]]}]
    heading = "CMS-1500 Health Insurance Claim Form"
    person = affected(p, {"plan", "med"}, {
        "person": "The patient on the claim form.", "plan": "Member ID in the patient block.",
        "med": "Diagnosis codes and descriptions for the patient."})
    np_ = [{"name": "Dr. %s %s" % (prov[0], prov[1]),
            "why": "The treating provider. The name and practice address are business contact details, "
                   "not an affected individual."}]
    return doc("claim", "cust-claims", "Claim: %s, %s" % (p["last"], p["first"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["provider"])


def visit_note():
    p = new_person()
    prov = rng.choice(PROVIDERS)
    code, desc = rng.choice(DIAGNOSES)
    with_plan = rng.random() < 0.4
    fields = [["Patient", "%s %s" % (p["first"], p["last"])], ["DOB", p["dob"]], ["MRN", mrn()]]
    if with_plan:
        fields.append(["Member ID", member_id()])
    sections = [{"label": "Patient", "fields": fields},
                {"label": "Assessment", "fields": [["Diagnosis", "%s (%s)" % (desc, code)]]},
                {"label": "Plan", "fields": [["Medication", rng.choice(MEDS)],
                                             ["Follow-up", "%d weeks" % rng.randint(2, 12)]]},
                {"label": "Signed", "fields": [["Clinician", "%s %s, %s" % prov]]}]
    heading = "Progress note: Larkspur care-management review"
    elements = {"mrn", "med"} | ({"plan"} if with_plan else set())
    why = {"person": "The patient named in the progress note.",
           "mrn": "Medical record number in the patient block.",
           "med": "Diagnosis and medication for the patient."}
    if with_plan:
        why["plan"] = "Member ID in the patient block."
    person = affected(without(p, *ADDRESS), elements, why)
    np_ = [{"name": "%s %s" % (prov[0], prov[1]),
            "why": "The clinician who signed the note: business contact details, not an affected individual."}]
    return doc("visit-note", "cust-claims", "Progress note: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["provider"])


def w2():
    p = new_person()
    ec, es, ez = rng.choice(CITIES)
    sections = [
        {"label": "Employer", "fields": [
            ["Name", rng.choice(EMPLOYERS)], ["EIN", "91-" + digits(7)],
            ["Address", "%d %s, %s, %s %s" % (rng.randint(100, 9000), rng.choice(STREETS), ec, es, ez)]]},
        {"label": "Employee", "fields": [
            ["a  Employee's SSN", ssn()], ["e  Employee's name", "%s %s" % (p["first"], p["last"])],
            ["f  Address", p["street"]], ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])]]},
        {"label": "Wages", "fields": [
            ["1  Wages, tips", "$%s.00" % format(rng.randint(28000, 140000), ",")],
            ["2  Federal tax withheld", "$%s.00" % format(rng.randint(2000, 24000), ",")]]}]
    heading = "Form W-2 Wage and Tax Statement 2024"
    person = affected(without(p, "dob"), {"ssn"},
                      {"person": "The employee on the W-2.", "ssn": "Box a: the employee's SSN."})
    return doc("w2", "cust-hr", "W-2: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person])


def direct_deposit():
    p = new_person()
    with_address = rng.random() < 0.5
    fields = [["Employee name", "%s %s" % (p["first"], p["last"])], ["Employee ID", "E" + digits(6)],
              ["SSN (last 4)", masked_ssn()]]
    if with_address:
        fields += [["Home address", p["street"]],
                   ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])]]
    sections = [{"label": "Employee", "fields": fields},
                {"label": "Deposit account", "fields": [
                    ["Bank", rng.choice(["Puget First Credit Union", "Harborline Bank", "Summit Federal"])],
                    ["Routing number", digits(9)], ["Account number", digits(11)],
                    ["Account type", rng.choice(["Checking", "Savings"])]]}]
    heading = "Direct Deposit Authorization"
    base = without(p, "dob") if with_address else without(p, "dob", *ADDRESS)
    person = affected(base, {"fin"},
                      {"person": "The employee on the direct-deposit form.",
                       "fin": "Routing and account numbers in the deposit section."},
                      {"ssn": "Only the last four digits are shown (XXX-XX-dddd): a masked SSN does not count."})
    return doc("direct-deposit", "cust-hr", "Direct deposit: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               traps=["masked-ssn"])


def i9():
    p = new_person()
    use_passport = rng.random() < 0.5
    with_ssn = rng.random() < 0.5
    rep = rng.choice(STAFF)
    s1 = [["Last name", p["last"]], ["First name", p["first"]], ["Address", p["street"]],
          ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])],
          ["Date of birth", p["dob"]], ["U.S. Social Security number", ssn() if with_ssn else ""]]
    if use_passport:
        s2 = [["List A document", "U.S. Passport"], ["Document number", passport_number()],
              ["Expiration", "%02d/%02d/203%d" % (rng.randint(1, 12), rng.randint(1, 28), rng.randint(0, 5))]]
    else:
        s2 = [["List B document", "Driver's license (%s)" % p["state"]], ["Document number", dl_number()],
              ["List C document", "Birth certificate"]]
    s3 = [["Employer representative", "%s %s, %s" % rep], ["Business email", work_email(rep[0], rep[1])]]
    sections = [{"label": "Section 1. Employee information", "fields": s1},
                {"label": "Section 2. Documents reviewed", "fields": s2},
                {"label": "Certification", "fields": s3}]
    heading = "Form I-9 Employment Eligibility Verification"
    doc_el = "passport" if use_passport else "dl"
    why = {"person": "The employee in Section 1.",
           doc_el: "Passport number in Section 2." if use_passport else "Driver's license number in Section 2."}
    if with_ssn:
        why["ssn"] = "SSN in Section 1."
    person = affected(p, {doc_el} | ({"ssn"} if with_ssn else set()), why)
    np_ = [{"name": "%s %s" % (rep[0], rep[1]),
            "why": "The employer's representative: a work name and email are business contact details."}]
    return doc("i9", "cust-hr", "I-9: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["business-contact"])


# ── Emails ───────────────────────────────────────────────────────────────────

def signature(st):
    return "\n\n%s %s\n%s, Larkspur Benefit Services\n%s | %s" % (
        st[0], st[1], st[2], phone(), work_email(st[0], st[1]))


def email_doc(custodian, subject, body, people, traps=None, why=None, extra_np=None):
    st = rng.choice(STAFF)
    e = {"from": "%s %s <%s>" % (st[0], st[1], work_email(st[0], st[1])),
         "to": "claims-ops@larkspur.example.com", "cc": "", "subject": subject, "body": body + signature(st)}
    np_ = [{"name": "%s %s" % (st[0], st[1]),
            "why": "The Larkspur staff member who sent the email: a work signature is business contact details."}]
    return doc("email", custodian, subject, "email", e, email_text(e), people,
               not_people=np_ + (extra_np or []), traps=["business-contact"] + (traps or []),
               why=why, frm=e["from"])


def email_payroll():
    p = new_person()
    body = ("Hi team,\n\nPlease update the direct deposit for %s %s before Friday's run. "
            "New Routing number %s, Account number %s. Home address on file: %s, %s, %s %s.\n\nThanks,"
            % (p["first"], p["last"], digits(9), digits(11), p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"fin"}, {"person": "The employee named in the payroll request.",
                                                   "fin": "The new routing and account numbers."})
    return email_doc("cust-hr", "Direct deposit change: %s %s" % (p["first"], p["last"]), body, [person])


def email_benefits():
    p = new_person()
    code, desc = rng.choice(DIAGNOSES)
    body = ("Member %s %s (DOB %s, member ID %s) called about a denied claim for %s (%s). "
            "Please review before the appeal deadline." % (p["first"], p["last"], p["dob"], member_id(), desc, code))
    person = affected(without(p, *ADDRESS), {"plan", "med"},
                      {"person": "The member who called.", "plan": "Member ID in the message.",
                       "med": "The diagnosis on the denied claim."})
    return email_doc("cust-benefits", "Denied claim follow-up", body, [person])


def email_credentials(unnamed):
    p = new_person()
    username = (p["first"][0] + p["last"]).lower()
    pw = "".join(rng.choice("ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#") for _ in range(10))
    body = ("Temporary credentials for %s %s: username %s, password %s. Please change them at first login."
            % (p["first"], p["last"], username, pw))
    traps, why = [], None
    if unnamed:
        body += "\n\nLog excerpt from the failed sync:\n  ERR record %s not found in eligibility index" % ssn()
        traps = ["unnamed-ssn"]
        why = "The SSN in the log excerpt has no name attached, so it is not recorded."
    person = affected(without(p, "dob", *ADDRESS), {"login"},
                      {"person": "The account holder named in the message.",
                       "login": "Username and password together."})
    return email_doc("cust-it", "Temporary credentials", body, [person], traps=traps, why=why)


def email_biometric():
    p = new_person()
    body = ("%s %s's fingerprint template was enrolled on the new timeclock (template ID FP-%s)."
            % (p["first"], p["last"], digits(8)))
    person = affected(without(p, "dob", *ADDRESS), {"bio"},
                      {"person": "The employee enrolled on the timeclock.",
                       "bio": "The fingerprint template enrolment."})
    return email_doc("cust-hr", "Timeclock enrolment", body, [person])


def email_card():
    p = new_person()
    body = ("%s %s paid the COBRA premium by card %s, exp %02d/2%d. Billing address %s, %s, %s %s."
            % (p["first"], p["last"], rng.choice(TEST_CARDS), rng.randint(1, 12), rng.randint(6, 9),
               p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"card"},
                      {"person": "The member who paid the premium.", "card": "The full card number."})
    return email_doc("cust-finance", "COBRA premium payment", body, [person])


def email_masked_pair():
    ghost, p = new_person(), new_person()
    body = ("Two follow-ups from the call queue:\n1. %s %s asked whether their SSN (%s) was exposed. "
            "No other details were given.\n2. %s %s (member ID %s) needs a replacement ID card mailed to "
            "%s, %s, %s %s." % (ghost["first"], ghost["last"], masked_ssn(), p["first"], p["last"],
                                member_id(), p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"plan"},
                      {"person": "The member who needs a replacement card.",
                       "plan": "Member ID in the message."})
    np_ = [{"name": "%s %s" % (ghost["first"], ghost["last"]),
            "why": "Only a masked SSN is given: that is not a data element, so this is not an affected individual."}]
    return email_doc("cust-benefits", "Call queue follow-ups", body, [person],
                     traps=["masked-ssn"], extra_np=np_)


def email_census_excerpt():
    ps = [new_person() for _ in range(3)]
    lines = ["%s, %s | %s | %s | %s, %s, %s %s" % (p["last"], p["first"], p["dob"], ssn(), p["street"],
                                                   p["city"], p["state"], p["zip"]) for p in ps]
    body = "Pasting the three rows that failed the eligibility upload:\n" + "\n".join(lines)
    people = [affected(p, {"ssn"}, {"person": "A row pasted from the failed upload.",
                                    "ssn": "SSN in the pasted row."}) for p in ps]
    return email_doc("cust-benefits", "Failed eligibility rows", body, people)


# ── Documents without PII ────────────────────────────────────────────────────

POLICY_TOPICS = ["Acceptable Use", "Clean Desk", "Screen Lock", "Remote Work", "Records Retention",
                 "Vendor Onboarding", "Incident Escalation", "Travel and Expenses", "Visitor Access",
                 "Mobile Devices"]
TICKET_TOPICS = ["VPN drops on floor 3", "Printer queue stuck", "Laptop fan noise", "Shared drive slow",
                 "Monitor flicker", "Outlook calendar sync", "Badge reader offline", "Wi-Fi in room 204",
                 "Software licence renewal", "Conference room display"]
MARKETING_TOPICS = ["Open enrolment reminder", "Wellness fair", "Flu shot clinic", "New telehealth partner",
                    "Dental plan highlights", "Spring newsletter", "Retirement planning webinar",
                    "Member portal refresh"]
MEETING_TOPICS = ["Q2 vendor review", "Budget check-in", "Claims backlog stand-up", "Office move planning",
                  "Quarterly all-hands prep", "Audit readiness", "Broker renewal prep", "Portal release retro",
                  "Training calendar", "Facilities walkthrough"]


def text_doc(kind, custodian, subject, text, traps=None, why=None):
    return doc(kind, custodian, subject, "text", text, subject + "\n" + text,
               [], traps=traps, why=why)


def no_pii_docs():
    docs = []
    staff_note = ("No one here has a data element exposed: staff names and work contact details "
                  "are business information.")
    for t in POLICY_TOPICS:
        docs.append(text_doc("policy", rng.choice(["cust-hr", "cust-benefits"]), "%s Policy v%d.%d" % (
            t, rng.randint(1, 4), rng.randint(0, 9)),
            "Purpose. This policy sets out Larkspur's expectations for %s.\n\nScope. It applies to all "
            "staff and contractors.\n\nReview. Owned by the policy committee and reviewed annually." % t.lower()))
    for t in TICKET_TOPICS:
        st = rng.choice(STAFF)
        docs.append(text_doc("it-ticket", "cust-it", "INC-%s: %s" % (digits(5), t),
            "Reported by the %s team. Assigned to %s %s (%s). Status: resolved after a restart and a "
            "configuration check. No data was accessed." % (rng.choice(["claims", "benefits", "finance"]),
                                                            st[0], st[1], st[2]), why=staff_note))
    for t in MARKETING_TOPICS:
        docs.append(text_doc("marketing", "cust-benefits", t,
            "%s. Join us to learn what's new for plan year 2025. Visit the member portal for details, "
            "or call the member line." % t))
    for _ in range(2):
        people = [new_person() for _ in range(8)]
        cols = ["Name", "Street", "City", "State", "ZIP"]
        rows = [["%s %s" % (p["first"], p["last"]), p["street"], p["city"], p["state"], p["zip"]] for p in people]
        caption = "Spring newsletter: print mailing list"
        docs.append(doc("marketing", "cust-benefits", caption, "table",
                        {"caption": caption, "columns": cols, "rows": rows, "pageBreakBefore": None},
                        table_text(caption, cols, rows, None), [], traps=["name-only"],
                        why="A newsletter mailing list: names and addresses only, with no data element, "
                            "so no one here is an affected individual."))
    for t in MEETING_TOPICS:
        a, b = rng.sample(STAFF, 2)
        docs.append(text_doc("meeting-notes", rng.choice(["cust-finance", "cust-benefits"]), "Notes: " + t,
            "Attendees: %s %s, %s %s.\n\nDiscussed timelines, owners and open questions. Next check-in "
            "in two weeks." % (a[0], a[1], b[0], b[1]), why=staff_note))
    return docs


# ── Build, check, write ──────────────────────────────────────────────────────

def build():
    docs = [roster() for _ in range(17)] + [roster(dup=True) for _ in range(3)]
    docs += [claim() for _ in range(25)]
    docs += [visit_note() for _ in range(15)]
    docs += [w2() for _ in range(10)]
    docs += [direct_deposit() for _ in range(10)]
    docs += [i9() for _ in range(8)]
    docs += [email_payroll() for _ in range(4)]
    docs += [email_benefits() for _ in range(5)]
    docs += [email_credentials(unnamed=(i < 3)) for i in range(4)]
    docs += [email_biometric() for _ in range(2)]
    docs += [email_card() for _ in range(3)]
    docs += [email_masked_pair() for _ in range(2)]
    docs += [email_census_excerpt() for _ in range(2)]
    docs += no_pii_docs()
    rng.shuffle(docs)
    return [dict([("id", "LBS-%04d" % (i + 1))] + list(d.items())) for i, d in enumerate(docs)]


def check(docs):
    problems = []
    kinds = Counter(d["type"] for d in docs)
    if dict(kinds) != KIND_COUNTS:
        problems.append("kind counts %s differ from %s" % (dict(kinds), KIND_COUNTS))
    ids = [d["id"] for d in docs]
    if len(ids) != 150 or len(set(ids)) != 150:
        problems.append("ids are not 150 unique values")
    traps = Counter(t for d in docs for t in d["traps"])
    for t, n in TRAP_MINIMUMS.items():
        if traps[t] < n:
            problems.append("trap %s appears %d times; needs %d" % (t, traps[t], n))
    for d in docs:
        text, a = d["body"], d["answer"]
        for s in re.findall(r"\b\d{3}-\d{2}-\d{4}\b", text):
            if not re.match(r"^9\d\d-00-\d{4}$", s):
                problems.append("%s: unsafe SSN %s" % (d["id"], s))
        for ph in re.findall(r"555-\d{4}", text):
            if not ph.startswith("555-01"):
                problems.append("%s: phone outside 555-01xx: %s" % (d["id"], ph))
        for em in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", text):
            if not em.endswith("example.com"):
                problems.append("%s: a real-looking email %s" % (d["id"], em))
        if a["noPii"] != (not a["people"]):
            problems.append("%s: noPii disagrees with people" % d["id"])
        if d["type"] in NO_PII_KINDS:
            if a["people"]:
                problems.append("%s: a no-PII kind has people" % d["id"])
            for pat in NO_PII_PATTERNS:
                if re.search(pat, text):
                    problems.append("%s: a no-PII document matches %s" % (d["id"], pat))
        names = [(p["first"], p["last"]) for p in a["people"]]
        for p in a["people"]:
            if not any(p["el"].values()):
                problems.append("%s: %s %s has no element" % (d["id"], p["first"], p["last"]))
            for f in ("first", "last", "dob", "street", "city", "state", "zip"):
                if p[f] and p[f] not in text:
                    problems.append("%s: %s %r is not in the document" % (d["id"], f, p[f]))
        for np_ in a.get("notPeople", []):
            for first, last in names:
                if first in np_["name"] and last in np_["name"]:
                    problems.append("%s: %s is both a person and not" % (d["id"], np_["name"]))
        if d["type"] == "direct-deposit" and any(p["el"]["ssn"] for p in a["people"]):
            problems.append("%s: a masked SSN ticks the SSN box" % d["id"])
        if "provider" in d["traps"] and not a.get("notPeople"):
            problems.append("%s: a provider document explains no provider" % d["id"])
    return problems


def write(docs):
    js = ("/* Generated by tools/build_cir_docs.py. Do not edit by hand.\n"
          "   Larkspur Benefit Services is a fictional matter: every person and number in it is\n"
          "   invented. See the generator's docstring for the safety rules. */\n"
          "var CIR_DOCS = [\n" + ",\n".join(json.dumps(d, separators=(",", ":")) for d in docs) + "\n];\n"
          "if (typeof module !== 'undefined' && module.exports) module.exports = CIR_DOCS;\n")
    with open(OUT, "w") as f:
        f.write(js)


if __name__ == "__main__":
    docs = build()
    problems = check(docs)
    if problems:
        print("Refusing to write cir-docs.js; %d problem(s):" % len(problems))
        for p in problems[:40]:
            print("  -", p)
        sys.exit(1)
    write(docs)
    print("wrote %s: %d documents, %d people" % (OUT, len(docs), sum(len(d["answer"]["people"]) for d in docs)))
