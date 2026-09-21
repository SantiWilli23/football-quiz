const fs=require("fs");
function edit(f,pairs){let s=fs.readFileSync(f,"utf8");for(const [a,b] of pairs){if(!s.includes(a))throw new Error(f+": "+a.slice(0,70));s=s.replace(a,()=>b)}fs.writeFileSync(f,s)}
edit("client/src/pages/Dashboard.jsx",[
 ['import ContinuePlaying, { findSavedGames } from "../components/ContinuePlaying.jsx";','import ContinuePlaying, { findSavedGames } from "../components/ContinuePlaying.jsx";\nimport DailyChallenge from "../components/DailyChallenge.jsx";'],
 ['{pending.length > 0 && (','<DailyChallenge />\n\n        {pending.length > 0 && ('],
]);
