# 📘 Sacco Management System: User Testing Guide (v1.0 Beta)

**Objective:** Validation of core Sacco operations including Membership, Loan Lifecycles, Voting, and Financial Tracking.
**System URL:** `http://localhost:5173` (or your deployed link)

---

## 🛠️ Phase 1: System Initialization (Admin Only)
*Before testing begins, the Administrator must ensure the system is ready.*

1.  **Login as Admin**
    * **Credentials:** Use the default admin credentials set in your `.env` file (e.g., `admin@sacco.com` / `S@cc0_.Adm!n123`).
    * **Dashboard Check:** Ensure you are redirected to the Admin Dashboard (or `.../x4r8q` if obfuscated).
2.  **Verify Settings**
    * Navigate to **System Settings**.
    * Ensure **Loan Interest Rate**, **Registration Fee**, and **Max Guarantee Limits** are set.

---

## 👥 Phase 2: Membership & Onboarding (Chairperson)
*Test the manual registration process for offline members.*

**Actor:** Chairperson (or Admin)

1.  **Navigate to "Add Member" Tab**:
    * Enter details for a test user (e.g., "John Doe").
    * **Critical Test:** Select `MEMBER` role. The system should ask for a "Registration Fee Ref".
    * Enter a mock Reference Code (e.g., `MPESA_001`) and submit.
2.  **Verification**:
    * Go to the **Directory** tab. Verify "John Doe" appears in the list.
    * Go to the **Finance** tab. Verify `KES 500` (or your fee amount) appears under "Reg Fees".

---

## 🔄 Phase 3: The Loan Lifecycle (The "Golden Path")
*This is the most critical workflow involving 5 different roles. Please test in this exact order.*

### Step 1: Application (Member)
* **Login**: As the new Member (John Doe).
* **Action**: Click **"Apply for Loan"**.
    * Request: `KES 5,000`.
    * Purpose: "Emergency Funds".
    * Guarantors: Select 2 other active members from the dropdown.
* **Outcome**: The loan status should change to `PENDING_GUARANTORS`.

### Step 2: Guaranteeing (Member/Guarantor)
* **Login**: As one of the selected Guarantors.
* **Action**: Check **"Guarantor Requests"** tab.
    * You should see John Doe's request.
    * Click **"Accept"**.
* **Outcome**: Once all guarantors accept, the loan moves to `PROCESSING` (Officer Stage).

### Step 3: Vetting (Loan Officer)
* **Login**: As Loan Officer.
* **Action**: Navigate to **"Applications"** tab.
* **Review**:
    * Check the applicant's savings vs. loan request.
    * Check Guarantor credibility.
    * Click **"Endorse"** if valid.
* **Outcome**: Loan moves to `PENDING_SECRETARY` (or directly to agenda depending on configuration).

### Step 4: Tabling the Motion (Secretary)
* **Login**: As Secretary.
* **Action**: View pending/endorsed loans.
* **Task**: Click **"Table Motion"** to add John Doe's loan to the next meeting's agenda.
* **Outcome**: Loan status updates to `TABLED_FOR_VOTING`.

### Step 5: Voting (Chairperson)
* **Login**: As Chairperson.
* **Action**: Go to **"Voting"** tab.
* **Task**: You will see "Motion: Loan for John Doe". Click **"Open Voting"**.
* **Note**: In a real meeting, members would now vote. For this test, you (as Chair) can click **"Approve Motion"** to finalize the decision.
* **Outcome**: Loan status becomes `APPROVED`.

---

## 💰 Phase 4: Treasury & Disbursement (Treasurer)
*Testing the new Liquidity Checks and Financial Records.*

**Actor:** Treasurer

1.  **Check Liquidity (Safety Test)**
    * **Login** as Treasurer.
    * **Action**: Look at the **"Liquidity"** card.
    * *Scenario A (Low Funds)*: If "Liquidity" is `KES 2,000` and John needs `KES 5,000`, the **"Disburse"** button should be **Disabled (Greyed out)**.
    * *Scenario B (Sufficient Funds)*: If "Liquidity" is high, the button is **Blue/Active**.

2.  **Process Disbursement**
    * Find John Doe's approved loan in the **"Disbursement Queue"**.
    * Click **"Disburse"**. Confirm the popup.
    * **Success**: The system should alert "Funds Disbursed".

3.  **Verify Financials**
    * Switch to the **"Financial Records"** tab.
    * Filter by **"Disbursements"** (or "Outflow").
    * **Verify**: You should see a record: `John Doe | LOAN_DISBURSEMENT | - KES 5,000`.
    * **Check Liquidity**: The "Liquidity" card value should have decreased by 5,000.

---

## 🛑 Phase 5: Edge Case Testing (Try to "Break" it)

1.  **The "Broke" Treasurer**:
    * Manually add a dummy `LOAN_DISBURSEMENT` record in the database (or via Admin) that drains the funds.
    * Log in as Treasurer and try to pay out a new loan.
    * **Expected Result**: The "Pending Payouts" card turns **RED**, and disbursement is blocked.

2.  **The "Greedy" Member**:
    * Log in as a Member who already has an active loan.
    * Try to apply for a second loan.
    * **Expected Result**: System should reject the application (One active loan policy).

3.  **The "Unauthorized" Access**:
    * Log in as a Member.
    * Try to manually type the URL for the Admin dashboard (e.g., `/u/x4r8q` or `/admin`).
    * **Expected Result**: Immediate redirection to the Member Dashboard or Login screen.

---

## 📋 Client Feedback Form Template

When handing this to your client, ask them to fill out this simple format for any bugs:

| Role Tested | Action Attempted | Expected Result | Actual Result | Screenshot |
| :--- | :--- | :--- | :--- | :--- |
| Treasurer | Click Disburse | Money sent | Error 500: Permission Denied | [Image] |
| Member | Login | Dashboard | White Screen | [Image] |