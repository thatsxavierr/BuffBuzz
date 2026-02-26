# Git Merge Guide – Partner's server.js

Your code is committed. Here's how to merge your partner's changes.

---

## Option A: Partner has their code in a Git repo (GitHub/GitLab)

1. **Add their repo as a remote:**
   ```bash
   git remote add partner <their-repo-url>
   ```

2. **Fetch their code:**
   ```bash
   git fetch partner
   ```

3. **Create a branch with their changes:**
   ```bash
   git checkout -b partner-merge
   git merge partner/main   # or partner/master, depending on their branch name
   ```

4. **Resolve conflicts** in `server.js` – Git will mark conflicts. Edit the file, keep what you need from both versions, then:
   ```bash
   git add server.js
   git commit -m "Merge partner's server.js"
   ```

---

## Option B: Partner sends you their server.js file

1. **Save their file** as `server-partner.js` in your project folder.

2. **Create a branch for the merge:**
   ```bash
   git checkout -b partner-merge
   ```

3. **Replace your server.js with theirs temporarily** (to create a merge scenario):
   ```bash
   cp server.js server-mine.js      # backup your version
   cp server-partner.js server.js   # use theirs
   git add server.js
   git commit -m "Partner's server.js"
   ```

4. **Merge your version back:**
   ```bash
   git checkout master
   git merge partner-merge
   ```
   You'll get conflicts. Resolve them manually, keeping your changes where needed.

   **Or** use a different approach: keep your `server.js`, manually copy new endpoints/features from `server-partner.js` into yours, then commit.

---

## Option C: Manual merge (simplest if you know what they added)

1. **Keep your `server.js`** – don't overwrite it.

2. **Open both files** – yours and your partner's – side by side.

3. **Identify what's new** in their file (endpoints, imports, middleware).

4. **Copy those sections** into your file in the right places.

5. **Commit:**
   ```bash
   git add server.js
   git commit -m "Merge partner's server.js changes"
   ```

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `git status` | See what's changed |
| `git log --oneline` | See commit history |
| `git diff server.js` | See uncommitted changes in server.js |
| `git checkout -- server.js` | Discard changes and restore last committed version |

---

## If something goes wrong

To go back to your last commit and discard all changes:
```bash
git checkout -- server.js
```

To see your current branch:
```bash
git branch
```
