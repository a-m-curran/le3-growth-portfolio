# D2L Brightspace Integration — Requirements from NLU

## What We Need

### 1. API Access Registration

**Who to ask:** Brightspace system administrator (IT department)

**What to request:** Register an OAuth2 application in Brightspace's **Manage Extensibility** tool.

**Two options for grant type:**

| Option | Best For | What You Get |
|--------|----------|--------------|
| **Client Credentials Grant** (recommended) | Server-to-server sync, no user interaction needed | Client ID + JWKS URL. App acts as a service account. |
| **Authorization Code Grant** | Per-user access, each student authenticates | Client ID + Client Secret + Redirect URI. Users authorize via browser. |

**Recommendation:** Start with **Client Credentials Grant** so the system can pull assignments automatically without each student needing to authorize D2L separately. Assign a service user (e.g., a coach or admin account) that has read access to course assignments and submissions.

**Registration fields to provide:**
- Application Name: `LE3 Growth Portfolio`
- OAuth2 Scopes needed (space-delimited):
  ```
  dropbox:folders:read
  enrollment:orgunit:read
  core:*:*
  ```
- JWKS URL (for Client Credentials): We'll generate this and provide it
- Access Token Lifetime: `72000` (20 hours, maximum allowed)

---

### 2. Instance URL

**What:** The Brightspace instance URL for NLU.

**Format:** `https://[something].brightspace.com` (e.g., `https://nlu.brightspace.com`)

**Where to find it:** It's the URL students and faculty use to log into Brightspace/D2L.

---

### 3. Service User Assignment (for Client Credentials)

**What:** A user account that the API will act as when pulling data.

**Requirements:**
- Must be enrolled in the courses we want to sync (or have admin-level access)
- Must have permission to view assignment submissions and student class lists
- Can be a coach account, admin account, or dedicated service account

**Why:** The Client Credentials grant makes API calls as this user. If the user can't see a course's assignments, neither can our app.

---

### 4. LE3 Program Course Identification

**What:** A way to identify which courses in Brightspace are part of the LE3 program so the system can sync all of them.

**Context:** The Growth Portfolio serves the entire LE3 program, not a single course. A student might take SOC 155, HUM 150, BUS 200, and other LE3 courses across multiple quarters — assignments from all of them should flow into their portfolio and be tagged with durable skills.

**Options (in order of preference):**
1. **Org Unit parent/type** — If all LE3 courses share a common parent org unit or program-level container in Brightspace, we can query for all child courses automatically.
2. **Course code pattern** — If LE3 courses follow a naming convention or have a tag/attribute, we can filter by that.
3. **Manual course list** — Provide Org Unit IDs for all current LE3 course sections. We'd need this updated each quarter as new sections are created.
4. **Enrollment-based** — The service user is enrolled in all LE3 courses, and we sync everything the service user can see.

**Where to find Org Unit IDs:** In the Brightspace URL when viewing a course:
`https://nlu.brightspace.com/d2l/home/[THIS_NUMBER]`

**Ideal scenario:** The service user is enrolled in all LE3 courses (current and future), and we sync all of them automatically. New courses added to the program would be picked up on the next sync.

---

### 5. Student ID Mapping

**What:** A way to match D2L user IDs to our student records.

**Options (in order of preference):**
1. **Email match** — If D2L student emails match what students use to sign into our app (e.g., `@nlu.edu`), we can match automatically. This is the easiest.
2. **OrgDefinedId match** — D2L's `OrgDefinedId` field on classlist users could map to our `nlu_id` field if it contains the NLU student ID.
3. **Manual mapping** — We provide a CSV mapping D2L user IDs to our student IDs. Least preferred.

**Question for NLU:** Do Brightspace student accounts use the same @nlu.edu email addresses that students will use to sign into the Growth Portfolio?

---

## What We'll Set as Environment Variables

Once NLU provides the above, we configure three values in Vercel:

```
D2L_INSTANCE_URL=https://nlu.brightspace.com
D2L_ACCESS_TOKEN=<bearer-token-from-oauth>
D2L_API_VERSION=1.82
```

For Client Credentials, we'll also need to implement JWT assertion generation (one-time setup using the Client ID and a generated key pair).

---

## What the Integration Does Once Connected

1. **System syncs all LE3 courses** — either on a schedule or triggered by a coach/admin
2. For each course, calls D2L API to get all assignment/dropbox folders
3. For each assignment, for each enrolled student:
   - Pulls submission metadata (who submitted, when, grade if available)
   - Downloads submitted files (PDF, DOCX, TXT)
   - Extracts text content from files
   - Creates a `student_work` record linked to that student
   - AI auto-tags the assignment with 1-3 of the 12 durable skills
4. Tagged assignments from **all courses** appear in each student's conversation hub, grouped by skill — not by course
5. Students click any assignment to start a reflective conversation
6. The conversation engine uses the actual assignment content to ask specific, relevant questions
7. Over time, a student's portfolio accumulates work from every LE3 course they take, building a cross-course picture of skill development

**Scale:** The system is designed for the full LE3 program — multiple courses, multiple cohorts, multiple quarters. A student who takes 4 LE3 courses in a year will see assignments from all 4 in their hub, and their narratives will draw from conversations across all of them.

**Deduplication:** Assignments are tracked by external ID (`d2l:{courseId}:{folderId}`). Re-syncing won't create duplicates.

**Graceful fallback:** If D2L is not configured, CSV import remains fully functional as an alternative.

---

## Questions for NLU

1. What is NLU's Brightspace instance URL?
2. Can we register an OAuth2 application in Manage Extensibility, or does IT need to do this?
3. Is Client Credentials grant acceptable, or does institutional policy require per-user authorization?
4. Which user account should serve as the service user for API access?
5. Do Brightspace student emails match @nlu.edu emails used elsewhere?
6. How are LE3 courses organized in Brightspace? Is there a program-level container, a naming convention, or another way to identify all LE3 course sections?
7. Are there any institutional data governance requirements for API integrations that we need to comply with (FERPA documentation, data handling agreements)?
8. Is there an API sandbox or test environment available, or should we test against production with a test course?
