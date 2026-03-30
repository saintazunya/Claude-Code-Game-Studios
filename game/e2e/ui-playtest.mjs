/**
 * UI Playtest: 10 agent reviewers × 5 games each = 50 games through the real UI
 * Each agent selects actions via Playwright button clicks, observes UI state,
 * and logs issues/feedback.
 */
import { chromium } from 'playwright';

// ─── Action ID → Chinese button text mapping ───────────────────────
const ACTION_TEXT = {
  workNone: '不干', workSlack: '摸鱼工作', workHard: '努力工作', workSuperHard: '超级努力',
  studySlack: '摸鱼', studyNormal: '正常', studyHard: '努力',
  upskill: '技能进修', prepJobChange: '跳槽面试', researchNiw: '研究NIW',
  publishPaper: '发论文', consultLawyer: '咨询移民律师', day1Cpt: 'Day1-CPT',
  invest: '投资理财', rest: '休息调整', hospital: '去医院', travel: '旅游度假',
  exercise: '锻炼身体', therapist: '心理咨询', studyGpa: '刷GPA',
  searchIntern: '找实习', searchFullTimeJob: '找全职工作', thesisResearch: '论文研究',
  taRaWork: 'TA/RA', internWork: '实习努力', networking: '社交/招聘会',
  sideProject: 'Side Project', normalJobSearch: '找工作', urgentJobSearch: '紧急求职',
};

// ─── Agent Definitions ──────────────────────────────────────────────
const AGENTS = [
  {
    name: '小王-均衡型', preset: '学霸',
    academicPriority: ['searchIntern', 'internWork', 'networking', 'sideProject', 'searchFullTimeJob'],
    careerPriority: ['consultLawyer', 'upskill', 'exercise', 'prepJobChange'],
    attitudeAcademic: 1, // normal
    attitudeCareer: (health, mental) => health < 40 || mental < 30 ? 0 : mental > 60 ? 2 : 1,
    unemployedPriority: ['normalJobSearch', 'upskill', 'exercise'],
    sickPriority: ['hospital', 'rest', 'exercise'],
  },
  {
    name: '小李-卷王', preset: '学霸',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'studyGpa', 'networking', 'searchFullTimeJob'],
    careerPriority: ['consultLawyer', 'upskill', 'prepJobChange'],
    attitudeAcademic: 2, // hard
    attitudeCareer: (h, m) => h < 20 ? 0 : m < 20 ? 1 : 3,
    unemployedPriority: ['urgentJobSearch', 'upskill'],
    sickPriority: ['hospital', 'rest'],
  },
  {
    name: '小张-养生', preset: '铁人',
    academicPriority: ['exercise', 'rest', 'searchIntern', 'internWork', 'networking', 'searchFullTimeJob'],
    careerPriority: ['exercise', 'rest', 'therapist', 'consultLawyer'],
    attitudeAcademic: 1,
    attitudeCareer: (h, m) => m < 50 ? 0 : 1,
    unemployedPriority: ['normalJobSearch', 'rest', 'exercise'],
    sickPriority: ['hospital', 'rest', 'exercise'],
  },
  {
    name: '小陈-PhD学术', preset: '学霸',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'networking', 'searchFullTimeJob'],
    careerPriority: ['consultLawyer', 'publishPaper', 'researchNiw', 'upskill'],
    attitudeAcademic: 2,
    attitudeCareer: (h, m) => m < 30 ? 0 : 2,
    unemployedPriority: ['normalJobSearch', 'researchNiw', 'publishPaper'],
    sickPriority: ['rest', 'hospital', 'therapist'],
  },
  {
    name: '小赵-焦虑H1B', preset: null, // default build
    academicPriority: ['searchIntern', 'internWork', 'studyGpa', 'networking', 'sideProject', 'searchFullTimeJob'],
    careerPriority: ['consultLawyer', 'upskill', 'exercise'],
    attitudeAcademic: 2,
    attitudeCareer: (h, m) => m < 25 ? 0 : 2,
    unemployedPriority: ['urgentJobSearch', 'upskill', 'therapist'],
    sickPriority: ['hospital', 'rest', 'therapist'],
  },
  {
    name: '小刘-老兵', preset: '学霸',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'networking', 'searchFullTimeJob'],
    careerPriority: ['consultLawyer', 'publishPaper', 'researchNiw', 'upskill'],
    attitudeAcademic: 2,
    attitudeCareer: (h, m) => m < 20 ? 0 : 2,
    unemployedPriority: ['urgentJobSearch', 'consultLawyer', 'researchNiw'],
    sickPriority: ['hospital', 'rest'],
  },
  {
    name: '小周-攒钱', preset: '地头蛇',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'networking', 'studyGpa', 'searchFullTimeJob'],
    careerPriority: ['invest', 'upskill', 'exercise', 'consultLawyer', 'prepJobChange'],
    attitudeAcademic: 1,
    attitudeCareer: (h, m) => m < 40 ? 1 : h > 60 ? 2 : 1,
    unemployedPriority: ['normalJobSearch', 'invest', 'exercise'],
    sickPriority: ['hospital', 'rest'],
  },
  {
    name: '小吴-随机', preset: null,
    academicPriority: [], // random
    careerPriority: [], // random
    attitudeAcademic: 1,
    attitudeCareer: () => Math.floor(Math.random() * 3),
    unemployedPriority: [],
    sickPriority: [],
  },
  {
    name: '小孙-跳槽', preset: '学霸',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'networking', 'searchFullTimeJob'],
    careerPriority: ['upskill', 'prepJobChange', 'consultLawyer'],
    attitudeAcademic: 2,
    attitudeCareer: (h, m) => m < 25 ? 0 : 2,
    unemployedPriority: ['urgentJobSearch', 'upskill'],
    sickPriority: ['hospital', 'rest'],
  },
  {
    name: '小马-逆袭', preset: '铁人',
    academicPriority: ['searchIntern', 'internWork', 'sideProject', 'studyGpa', 'networking', 'searchFullTimeJob'],
    careerPriority: ['upskill', 'consultLawyer', 'prepJobChange'],
    attitudeAcademic: 2,
    attitudeCareer: (h, m) => m < 20 ? 0 : h < 30 ? 1 : 3,
    unemployedPriority: ['urgentJobSearch', 'upskill', 'therapist'],
    sickPriority: ['hospital', 'rest', 'therapist'],
  },
];

// ─── Helper Functions ───────────────────────────────────────────────

async function dismissPopups(page) {
  for (let attempt = 0; attempt < 15; attempt++) {
    let dismissed = false;
    // Stock trading popup — click cancel
    const cancelBtn = page.locator('button').filter({ hasText: '取消' }).first();
    if (await cancelBtn.isVisible({ timeout: 60 }).catch(() => false)) {
      await cancelBtn.click().catch(() => {});
      await page.waitForTimeout(80);
      dismissed = true;
    }
    // Event choice popup — click first choice tag
    for (const tag of ['稳妥', '中立', '冒险', '节约', '花钱']) {
      const el = page.locator(`text=${tag}`).first();
      if (await el.isVisible({ timeout: 60 }).catch(() => false)) {
        await el.locator('..').click().catch(() => {});
        await page.waitForTimeout(80);
        dismissed = true;
        break;
      }
    }
    // Confirm choice
    const cfm = page.locator('button').filter({ hasText: '确认选择' }).first();
    if (await cfm.isVisible({ timeout: 60 }).catch(() => false) && await cfm.isEnabled()) {
      await cfm.click().catch(() => {});
      await page.waitForTimeout(80);
      dismissed = true;
    }
    // Quarter summary
    for (const t of ['下一季度', '继续游戏']) {
      const btn = page.locator('button').filter({ hasText: t }).first();
      if (await btn.isVisible({ timeout: 60 }).catch(() => false) && await btn.isEnabled()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(150);
        dismissed = true;
      }
    }
    if (!dismissed) break;
  }
}

async function getGameState(page) {
  const text = await page.locator('body').innerText();
  const turnMatch = text.match(/回合 (\d+)/);
  const turn = turnMatch ? parseInt(turnMatch[1]) : -1;
  const isAcademic = text.includes('研究生') || text.includes('GPA');
  const isGameOver = text.includes('被迫回国') || text.includes('破产') || text.includes('分享我的移民') || text.includes('绿卡到手');
  const health = text.match(/健康\n(\d+)%/)?.[1] || text.match(/💪 健康\n(\d+)/)?.[1] || '50';
  const mental = text.match(/精神\n(\d+)%/)?.[1] || text.match(/🧠 精神\n(\d+)/)?.[1] || '50';
  const isUnemployed = text.includes('失业');
  const isSick = text.includes('生病中') || text.includes('🤒');
  const isBurnout = text.includes('Burnout') || text.includes('💀');
  const hasLawyer = text.includes('已咨询') || text.includes('律师加成');
  const visa = text.match(/(F-1|OPT|OPT STEM|H-1B|H1B|Combo|绿卡)/)?.[1] || 'unknown';
  const ending = text.includes('被迫回国') ? 'deported' :
    text.includes('破产') ? 'bankrupt' :
    text.includes('绿卡到手') ? 'gc' :
    text.includes('分享我的移民') ? 'finished' : null;

  return { turn, isAcademic, isGameOver, health: parseInt(health), mental: parseInt(mental),
    isUnemployed, isSick, isBurnout, hasLawyer, visa, ending };
}

async function selectActions(page, agent, state) {
  let priorities;
  if (state.isSick || state.isBurnout) {
    priorities = agent.sickPriority;
  } else if (state.isUnemployed) {
    priorities = agent.unemployedPriority;
  } else if (state.isAcademic) {
    priorities = agent.academicPriority;
  } else {
    priorities = agent.careerPriority;
  }

  // Select attitude first
  if (!state.isAcademic) {
    const attLevel = typeof agent.attitudeCareer === 'function'
      ? agent.attitudeCareer(state.health, state.mental) : agent.attitudeCareer;
    const attTexts = ['不干', '摸鱼', '努力', '超级努力'];
    const attText = attTexts[Math.min(attLevel, 3)];
    // Attitude buttons are in the toggle bar — find by partial text match
    const attBtn = page.locator('button').filter({ hasText: attText }).first();
    if (await attBtn.isVisible({ timeout: 100 }).catch(() => false)) {
      await attBtn.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }

  // Select priority actions
  let selected = 0;
  for (const actionId of priorities) {
    const text = ACTION_TEXT[actionId];
    if (!text) continue;
    const btn = page.locator('button').filter({ hasText: text }).first();
    if (await btn.isVisible({ timeout: 80 }).catch(() => false) && await btn.isEnabled()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(80);
      selected++;
      if (selected >= 4) break; // don't overselect
    }
  }

  // If no priorities matched, click random available actions
  if (selected === 0) {
    const allBtns = page.locator('button');
    const count = await allBtns.count();
    for (let i = 0; i < count && selected < 2; i++) {
      const btn = allBtns.nth(i);
      const txt = await btn.innerText().catch(() => '');
      if (txt.includes('AP') && !txt.includes('结束') && !txt.includes('🤖') && !txt.includes('股票') && await btn.isEnabled()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(80);
        selected++;
      }
    }
  }
}

async function playGame(page, agent, gameNum) {
  await page.goto('http://localhost:4174/Claude-Code-Game-Studios/');
  await page.waitForTimeout(1000);

  // Start new game
  const newGame = page.locator('button').filter({ hasText: '开始新游戏' }).first();
  if (await newGame.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newGame.click();
    await page.waitForTimeout(400);
  }

  // Select preset if specified
  if (agent.preset) {
    const preset = page.locator('button').filter({ hasText: agent.preset }).first();
    if (await preset.isVisible({ timeout: 500 }).catch(() => false)) {
      await preset.click();
      await page.waitForTimeout(200);
    }
  }

  // Start
  const start = page.locator('button').filter({ hasText: '确认出发' }).first();
  if (await start.isVisible({ timeout: 2000 }).catch(() => false)) {
    await start.click();
    await page.waitForTimeout(500);
  }

  const issues = [];
  const milestones = [];
  let lastTurn = -1;
  let turnsPlayed = 0;
  let stuckCount = 0;

  for (let attempt = 0; attempt < 100; attempt++) {
    await dismissPopups(page);
    const state = await getGameState(page);

    if (state.isGameOver) {
      milestones.push(`END:${state.ending}@T${state.turn}`);
      break;
    }

    if (state.turn === lastTurn) {
      stuckCount++;
      if (stuckCount > 5) {
        issues.push(`STUCK at turn ${state.turn} — popup not dismissing`);
        // Try harder to dismiss
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);
        if (stuckCount > 10) break;
        continue;
      }
    } else {
      stuckCount = 0;
      lastTurn = state.turn;
      turnsPlayed++;
    }

    // Log key milestones
    const text = await page.locator('body').innerText();
    if (text.includes('律师加成') && !milestones.some(m => m.includes('LAWYER'))) {
      milestones.push(`T${state.turn}:LAWYER`);
    }
    if (text.includes('研究NIW') && !milestones.some(m => m.includes('NIW_UNLOCKED'))) {
      milestones.push(`T${state.turn}:NIW_UNLOCKED`);
    }

    // Check for UI issues — only flag if lawyer never consulted AND neither action nor hint visible
    if (state.turn > 10 && state.turn < 20 && !state.isAcademic && !state.hasLawyer && !state.isGameOver) {
      if (!text.includes('咨询移民律师') && !text.includes('已咨询')) {
        issues.push(`T${state.turn}: no lawyer action or hint visible`);
      }
    }

    // Select actions
    await selectActions(page, agent, state);

    // End turn
    const endBtn = page.locator('button').filter({ hasText: '结束本季度' }).first();
    if (await endBtn.isVisible({ timeout: 300 }).catch(() => false) && await endBtn.isEnabled()) {
      await endBtn.click();
      await page.waitForTimeout(400);
    }
  }

  const finalState = await getGameState(page);
  return {
    agent: agent.name,
    game: gameNum,
    turns: finalState.turn,
    ending: finalState.ending || 'unknown',
    milestones,
    issues,
  };
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  console.log('═'.repeat(60));
  console.log('  UI PLAYTEST: 10 Agents × 5 Games = 50 Games');
  console.log('═'.repeat(60));

  for (const agent of AGENTS) {
    console.log(`\n── ${agent.name} ──`);
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

    for (let g = 1; g <= 5; g++) {
      try {
        const result = await playGame(page, agent, g);
        results.push(result);
        console.log(`  Game ${g}: ${result.ending} @ T${result.turns} | ${result.milestones.join(' → ') || 'no milestones'}`);
        if (result.issues.length > 0) {
          result.issues.forEach(i => console.log(`    ⚠️ ${i}`));
        }
      } catch (e) {
        console.log(`  Game ${g}: CRASH — ${e.message.substring(0, 80)}`);
        results.push({ agent: agent.name, game: g, turns: -1, ending: 'crash', milestones: [], issues: [`CRASH: ${e.message.substring(0, 100)}`] });
      }
    }

    await page.close();
  }

  // ─── Summary ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));

  const endings = {};
  const allIssues = [];
  for (const r of results) {
    endings[r.ending] = (endings[r.ending] || 0) + 1;
    allIssues.push(...r.issues);
  }

  console.log(`\nEndings: ${Object.entries(endings).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`Total games: ${results.length}`);
  console.log(`Avg turns: ${Math.round(results.reduce((s, r) => s + r.turns, 0) / results.length)}`);

  // Per-agent summary
  console.log('\nPer-agent:');
  for (const agent of AGENTS) {
    const agentResults = results.filter(r => r.agent === agent.name);
    const gc = agentResults.filter(r => r.ending === 'gc').length;
    const dep = agentResults.filter(r => r.ending === 'deported').length;
    const n = agentResults.length;
    const avgTurns = Math.round(agentResults.reduce((s, r) => s + r.turns, 0) / n);
    const lawyerUsed = agentResults.filter(r => r.milestones.some(m => m.includes('LAWYER'))).length;
    console.log(`  ${agent.name}: GC=${gc}/${n} Deport=${dep}/${n} AvgT=${avgTurns} Lawyer=${lawyerUsed}/${n}`);
  }

  // UI Issues
  if (allIssues.length > 0) {
    console.log(`\n⚠️ UI Issues (${allIssues.length} total):`);
    const unique = [...new Set(allIssues)];
    unique.slice(0, 20).forEach(i => console.log(`  - ${i}`));
  } else {
    console.log('\n✅ No UI issues detected');
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(e => console.error(e));
