# ECON 3003 – HOMEWORK #1 SOLUTIONS
**Format and style consistent with lecture notes**

---

## Question 1 [7 pts] – Extensive Form Game

**Strategic situation:** Javonie guesses which door Lycenia is behind; Malik (host) chooses a color; Javonie picks a door.

**Players:** Lycenia (L), Malik (M), Javonie (J)

**Order of play:**
1. Lycenia chooses A or B (Javonie not present)
2. Malik observes Lycenia’s choice and chooses Red or Green
3. Javonie observes Malik’s color (but not Lycenia’s choice) and chooses A or B

**Payoffs:** (Javonie, Lycenia, Malik)  
- Javonie: $100 if correct door, $0 if wrong  
- Lycenia: $100 if Javonie wrong, $0 if correct  
- Malik: 10 if Javonie picks A, 0 if Javonie picks B  

**Extensive form (decision tree):**

```
                    Lycenia
                   /      \
                 A          B
                /            \
              Malik          Malik
             /    \          /    \
          Red    Green    Red   Green
           |       |       |      |
        [cloud] [cloud] [cloud][cloud]  ← Javonie's information sets
           |       |       |      |
          Jav     Jav     Jav    Jav
         /  \    /  \    /  \   /  \
        A   B   A   B   A   B  A   B

Terminal payoffs (J,L,M):
Lycenia A, Malik Red:  J picks A → (100,0,10); J picks B → (0,100,0)
Lycenia A, Malik Green: J picks A → (100,0,10); J picks B → (0,100,0)
Lycenia B, Malik Red:  J picks A → (0,100,10); J picks B → (100,0,0)
Lycenia B, Malik Green: J picks A → (0,100,10); J picks B → (100,0,0)
```

**Information sets:**
- Lycenia: one decision node (no information set)
- Malik: two nodes (knows Lycenia’s choice)
- Javonie: two information sets – one when Malik chose Red, one when Malik chose Green (she does not know Lycenia’s choice)

---

## Question 2 [8 pts] – Normal Form from Extensive Form

*Note: The extensive-form diagram is in the PDF. The method is:*
1. Identify each player’s strategies (complete plans of action for every node/information set).
2. Build the normal-form matrix with strategies as rows/columns.
3. Enter payoffs for each strategy profile.

**General procedure:**
- For each information set, list the actions.
- A strategy for a player is a function from each of their information sets to an action.
- Enumerate all such strategies and fill the payoff matrix.

*(You will need to apply this to the specific tree in the assignment.)*

---

## Question 3 [6 pts total]

**Game:**
|       | **L**  | **R**  |
|-------|--------|--------|
| **U** | 3, 3   | 2, 0   |
| **D** | 4, 1   | 8, −1  |
| Payoff| (P1,P2)|        |

### (i) Strictly and weakly dominated strategies [2]

**Player 2:**  
- If P1 plays U: L gives 3, R gives 0 → L > R  
- If P1 plays D: L gives 1, R gives −1 → L > R  
So **R is strictly dominated by L** for Player 2.

**Player 1:**  
- If P2 plays L: U gives 3, D gives 4 → D > U  
- If P2 plays R: U gives 2, D gives 8 → D > U  
So **U is strictly dominated by D** for Player 1.

**Weakly dominated:** None. All remaining strategies are strictly best in some situation.

### (ii) Pure strategy Nash equilibrium [2]

After removing dominated strategies, only **(D, L)** remains.

Check:  
- Given P2 plays L, P1’s best reply is D (4 > 3).  
- Given P1 plays D, P2’s best reply is L (1 > −1).  

**Nash equilibrium: (D, L) with payoff (4, 1).**

### (iii) Dominant strategy equilibrium? [2]

Yes. **D** is a dominant strategy for Player 1 (best regardless of P2’s play), and **L** is a dominant strategy for Player 2 (best regardless of P1’s play). So **(D, L)** is a **dominant strategy equilibrium** as well as Nash.

---

## Question 4 [8 pts total]

**Game:**
|       | **L**  | **C**  | **R**  |
|-------|--------|--------|--------|
| **U** | 5, 9   | 0, 1   | 4, 3   |
| **M** | 3, 2   | 0, 9   | 1, 1   |
| **D** | 2, 8   | 0, 1   | 8, 4   |
| Payoff| (P1,P2)|        |

### (i) Weakly and strictly dominated strategies [2]

**Player 2:**
- When P1 plays U: L=9, C=1, R=3 → R < L  
- When P1 plays M: L=2, C=9, R=1 → R < C  
- When P1 plays D: L=8, C=1, R=4 → R < L  

So **R is strictly dominated by L** (L ≥ R in every row, with strict inequality when P1 plays U or D).

**Player 1:**  
No strategy is strictly dominated for P1 in the full game.

**Weakly dominated:**  
After removing R, in the reduced game M and D are strictly dominated by U when P2 plays L.

### (ii) Pure strategy Nash equilibria [4]

Best responses:
- BR₁(L) = U  (5 > 3, 2)  
- BR₁(C) = U, M, D  (all give 0)  
- BR₁(R) = D  (8 > 4, 1)  

- BR₂(U) = L  (9 > 1, 3)  
- BR₂(M) = C  (9 > 2, 1)  
- BR₂(D) = L  (8 > 1, 4)  

Mutual best replies:
- (U, L): BR₁(L) = U, BR₂(U) = L ✓  
- (M, C): BR₁(C) includes M, BR₂(M) = C ✓  

**Nash equilibria: (U, L) with payoff (5, 9) and (M, C) with payoff (0, 9).**

### (iii) Iterated dominance [2]

**Iterated elimination:**
1. R strictly dominated by L for P2 → remove R.  
2. In the reduced game (L, C), when P2 plays L, U gives 5, M gives 3, D gives 2, so M and D are strictly dominated by U for P1 → remove M and D.  
3. P1 plays U. P2 prefers L (9 > 1) → P2 plays L.

**Iterated dominance equilibrium: (U, L) with payoff (5, 9).**

So **(U, L)** can be reached by iterated dominance; **(M, C)** cannot (C is never a best reply once R is removed and P1 is reduced to U).

---

## Question 5 [16 pts total]

**Game:**
|       | **L**  | **R**  |
|-------|--------|--------|
| **U** | 3, 2   | 2, 1   |
| **D** | 4, 3   | 1, 4   |
| Payoff| (P1,P2)|        |

### (i) Pure strategy Nash equilibrium? [4]

Best responses:
- BR₁(L) = D  (4 > 3)  
- BR₁(R) = U  (2 > 1)  
- BR₂(U) = L  (2 > 1)  
- BR₂(D) = R  (4 > 3)  

There is no (s₁, s₂) such that s₁ ∈ BR₁(s₂) and s₂ ∈ BR₂(s₁):
- (U,L): P1 wants to deviate to D  
- (U,R): P2 wants to deviate to L  
- (D,L): P2 wants to deviate to R  
- (D,R): P1 wants to deviate to U  

**There is no Nash equilibrium in pure strategies.**

### (ii) Mixed strategy Nash equilibrium [10]

Let P1 play U with probability *p* and D with probability 1−*p*.  
Let P2 play L with probability *q* and R with probability 1−*q*.

**P2 indifference (between L and R):**
\[
2p + 3(1-p) = 1p + 4(1-p)
\]
\[
2p + 3 - 3p = p + 4 - 4p
\]
\[
-p + 3 = -3p + 4 \Rightarrow 2p = 1 \Rightarrow p^* = \frac{1}{2}
\]

**P1 indifference (between U and D):**
\[
3q + 2(1-q) = 4q + 1(1-q)
\]
\[
3q + 2 - 2q = 4q + 1 - q
\]
\[
q + 2 = 3q + 1 \Rightarrow 2q = 1 \Rightarrow q^* = \frac{1}{2}
\]

**Mixed strategy Nash equilibrium:**
- P1: \((\tfrac{1}{2} U, \tfrac{1}{2} D)\)
- P2: \((\tfrac{1}{2} L, \tfrac{1}{2} R)\)

**Expected payoffs:**
- P1: \(\tfrac{1}{2}\bigl(\tfrac{1}{2}(3) + \tfrac{1}{2}(2)\bigr) + \tfrac{1}{2}\bigl(\tfrac{1}{2}(4) + \tfrac{1}{2}(1)\bigr) = \tfrac{1}{2}(2.5) + \tfrac{1}{2}(2.5) = 2.5\)
- P2: \(\tfrac{1}{2}\bigl(\tfrac{1}{2}(2) + \tfrac{1}{2}(1)\bigr) + \tfrac{1}{2}\bigl(\tfrac{1}{2}(3) + \tfrac{1}{2}(4)\bigr) = \tfrac{1}{2}(1.5) + \tfrac{1}{2}(3.5) = 2.5\)

**Equilibrium expected payoffs: (2.5, 2.5).**

### (iii) Pareto optimality of mixed Nash [2]

Pure strategy payoffs: (3,2), (2,1), (4,3), (1,4).  
Mixed Nash gives (2.5, 2.5).

(4,3) Pareto dominates (2.5, 2.5): both players get more.  
So **(2.5, 2.5) is Pareto dominated** and the mixed strategy Nash equilibrium is **not Pareto optimal**.
