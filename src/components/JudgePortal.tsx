import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Clock, 
  Gavel, 
  FileText, 
  AlertCircle, 
  ChevronRight, 
  X, 
  Minus, 
  Plus, 
  Sparkles, 
  User, 
  Lock, 
  Copy, 
  ExternalLink,
  BookOpen,
  MessageSquare,
  Check
} from 'lucide-react';
import { DebateState, JudgeAccount } from '../App';
import { ClaimVisualButton } from './imageBots/ClaimVisualButton';

interface JudgePortalProps {
  state: DebateState;
  onStateUpdate: (state: DebateState) => void;
  formatTime: (seconds: number) => string;
}

interface BallotScores {
  reasoning: number;
  consistency: number;
  respond: number;
  persuasiveness: number;
  clarity: number;
  supported: number;
  contradiction: number;
  rules: number;
  topic: number;
  questions: number;
  respectful: number;
}

const DEFAULT_SCORES: BallotScores = {
  reasoning: 5,
  consistency: 5,
  respond: 5,
  persuasiveness: 5,
  clarity: 5,
  supported: 5,
  contradiction: 5,
  rules: 5,
  topic: 5,
  questions: 5,
  respectful: 5
};

export default function JudgePortal({ state, onStateUpdate, formatTime }: JudgePortalProps) {
  // Session / Authentication state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeJudge, setActiveJudge] = useState<JudgeAccount | null>(null);

  // Become a Judge states
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [signUpNickname, setSignUpNickname] = useState('');
  const [signUpBirthYear, setSignUpBirthYear] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpQ1, setSignUpQ1] = useState('');
  const [signUpQ2, setSignUpQ2] = useState('');
  const [signUpQ3, setSignUpQ3] = useState('');
  const [signUpStatus, setSignUpStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [signUpMessage, setSignUpMessage] = useState('');

  const currentYear = new Date().getFullYear();

  const handleJudgeSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpNickname.trim() || !signUpBirthYear || !signUpPassword) {
      setSignUpStatus('error');
      setSignUpMessage("Judge nickname, birth year, and console password are required.");
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpStatus('error');
      setSignUpMessage("Passwords do not match.");
      return;
    }
    if (!signUpQ1 || !signUpQ2 || !signUpQ3) {
      setSignUpStatus('error');
      setSignUpMessage("All screening questions must be answered.");
      return;
    }

    setSignUpStatus('submitting');
    setSignUpMessage('');

    try {
      const res = await fetch('/api/judges/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: signUpNickname.trim(),
          username: signUpNickname.trim(),
          birthYear: Number(signUpBirthYear),
          password: signUpPassword,
          q1: signUpQ1,
          q2: signUpQ2,
          q3: signUpQ3
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.permanentlyRejected) {
          setSignUpStatus('error');
          setSignUpMessage(data.message);
        } else {
          setSignUpStatus('success');
          setSignUpMessage(data.message);
        }
        onStateUpdate(data.state);
      } else {
        setSignUpStatus('error');
        setSignUpMessage(data.message || data.error || "Something went wrong.");
        if (data.state) {
          onStateUpdate(data.state);
        }
      }
    } catch (err) {
      console.error(err);
      setSignUpStatus('error');
      setSignUpMessage("Failed to submit application due to network error.");
    }
  };

  // Active seat / ballot selection
  const [selectedTeam, setSelectedTeam] = useState<'PROPOSER' | 'CONTRARY'>('PROPOSER');
  const [selectedSeat, setSelectedSeat] = useState<number>(1);

  // Explore panel open state
  const [exploreOpen, setExploreOpen] = useState(false);

  // Note auto-save status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Winner selection countdown timer
  const [timerSeconds, setTimerSeconds] = useState<number>(60);

  // Lazy initialize draft ballots so they aren't lost on re-renders, but are populated from server when available
  const [draftBallots, setDraftBallots] = useState<any[]>(() => {
    const savedJudgeId = sessionStorage.getItem('tt_judge_id') || activeJudge?.id;
    if (savedJudgeId && state.settings?.judgeAccounts) {
      const match = state.settings.judgeAccounts.find(j => j.id === savedJudgeId);
      if (match) {
        const ballots: any[] = [];
        const proSeats = state.settings?.proSeatsCount ?? 3;
        const conSeats = state.settings?.conSeatsCount ?? 3;
        const serverBallots = state.judgeBallots || [];

        // PRO team seats
        for (let s = 1; s <= proSeats; s++) {
          const m = serverBallots.find(
            b => b.judgeId === match.id && b.team === 'PROPOSER' && b.seat === s
          );
          ballots.push(m ? JSON.parse(JSON.stringify(m)) : {
            judgeId: match.id,
            team: 'PROPOSER',
            seat: s,
            scores: { ...DEFAULT_SCORES },
            notes: '',
            penalties: 0
          });
        }

        // CON team seats
        for (let s = 1; s <= conSeats; s++) {
          const m = serverBallots.find(
            b => b.judgeId === match.id && b.team === 'CONTRARY' && b.seat === s
          );
          ballots.push(m ? JSON.parse(JSON.stringify(m)) : {
            judgeId: match.id,
            team: 'CONTRARY',
            seat: s,
            scores: { ...DEFAULT_SCORES },
            notes: '',
            penalties: 0
          });
        }
        return ballots;
      }
    }
    return [];
  });

  // Auto-submit beacon on unload / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeJudge && draftBallots.length > 0) {
        navigator.sendBeacon(
          '/api/judges/logout',
          JSON.stringify({
            judgeId: activeJudge.id,
            ballots: draftBallots
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeJudge, draftBallots]);

  // Load judge session on mount
  useEffect(() => {
    const savedJudgeId = sessionStorage.getItem('tt_judge_id');
    if (savedJudgeId && state.settings?.judgeAccounts) {
      const match = state.settings.judgeAccounts.find(j => j.id === savedJudgeId);
      if (match && match.isActive !== false) {
        setActiveJudge(match);
        // Mark judge active on server
        fetch('/api/judges/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: match.username, password: match.password })
        }).catch(err => console.error('Error refreshing judge login:', err));
      } else if (match && match.isActive === false) {
        sessionStorage.removeItem('tt_judge_id');
        setActiveJudge(null);
      }
    }
  }, [state.settings?.judgeAccounts]);

  // Auto-logout when debate is reset by host
  useEffect(() => {
    if (activeJudge && state.settings?.judgeAccounts) {
      const currentAcc = state.settings.judgeAccounts.find(j => j.id === activeJudge.id);
      if (!currentAcc || currentAcc.isActive === false) {
        sessionStorage.removeItem('tt_judge_id');
        setActiveJudge(null);
      }
    }
  }, [state.settings?.judgeAccounts, state.resetTimestamp]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!username.trim() || !password.trim()) {
      setLoginError('Both username and password are required.');
      return;
    }

    try {
      const res = await fetch('/api/judges/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid credentials');
        return;
      }

      setActiveJudge(data.judge);
      sessionStorage.setItem('tt_judge_id', data.judge.id);
      if (data.state) {
        onStateUpdate(data.state);
      }
    } catch (err) {
      console.error('Error logging in:', err);
      setLoginError('Server connection error. Please try again.');
    }
  };

  const handleLogout = async () => {
    if (activeJudge) {
      try {
        const res = await fetch('/api/judges/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeId: activeJudge.id, ballots: draftBallots })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.state) onStateUpdate(data.state);
        }
      } catch (err) {
        console.error('Error logging out:', err);
      }
    }
    setActiveJudge(null);
    sessionStorage.removeItem('tt_judge_id');
  };

  // Helper to find participants for Seats 1-4 of each team
  const getParticipantForSeat = (team: 'PROPOSER' | 'CONTRARY', seatNum: number) => {
    const approvedList = (state.participants || []).filter(
      p => p.role === team && p.status !== 'pending'
    );
    // Map sequentially
    return approvedList[seatNum - 1] || null;
  };

  const currentJudgeInfo = state.settings?.judgeAccounts?.find(j => j.id === activeJudge?.id) || activeJudge;
  const isSubmitted = currentJudgeInfo?.isSubmitted || false;

  // Submit scores confirmation popup state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Track previous submitted state to detect reopening
  const [prevSubmitted, setPrevSubmitted] = useState<boolean | null>(null);

  // Synchronize draftBallots if activeJudge changes, or if reopened (isSubmitted changes from true to false)
  useEffect(() => {
    if (activeJudge) {
      const freshJudge = state.settings?.judgeAccounts?.find(j => j.id === activeJudge.id) || activeJudge;
      const currentlySubmitted = !!freshJudge.isSubmitted;

      if (draftBallots.length === 0 || currentlySubmitted !== prevSubmitted) {
        // Initialize from server
        const ballots: any[] = [];
        const proSeats = state.settings?.proSeatsCount ?? 3;
        const conSeats = state.settings?.conSeatsCount ?? 3;
        const serverBallots = state.judgeBallots || [];

        // PRO team seats
        for (let s = 1; s <= proSeats; s++) {
          const m = serverBallots.find(
            b => b.judgeId === activeJudge.id && b.team === 'PROPOSER' && b.seat === s
          );
          ballots.push(m ? JSON.parse(JSON.stringify(m)) : {
            judgeId: activeJudge.id,
            team: 'PROPOSER',
            seat: s,
            scores: { ...DEFAULT_SCORES },
            notes: '',
            penalties: 0
          });
        }

        // CON team seats
        for (let s = 1; s <= conSeats; s++) {
          const m = serverBallots.find(
            b => b.judgeId === activeJudge.id && b.team === 'CONTRARY' && b.seat === s
          );
          ballots.push(m ? JSON.parse(JSON.stringify(m)) : {
            judgeId: activeJudge.id,
            team: 'CONTRARY',
            seat: s,
            scores: { ...DEFAULT_SCORES },
            notes: '',
            penalties: 0
          });
        }

        setDraftBallots(ballots);
        setPrevSubmitted(currentlySubmitted);
      }
    } else {
      setDraftBallots([]);
      setPrevSubmitted(null);
    }
  }, [activeJudge, state.settings?.judgeAccounts, state.judgeBallots]);

  // Find or initialize ballot for current active seat & judge
  const getBallotForActiveSeat = () => {
    if (!activeJudge) return null;
    const match = draftBallots.find(
      b => b.team === selectedTeam && b.seat === selectedSeat
    );
    return match || {
      judgeId: activeJudge.id,
      team: selectedTeam,
      seat: selectedSeat,
      scores: { ...DEFAULT_SCORES },
      notes: '',
      penalties: 0
    };
  };

  const currentBallot = getBallotForActiveSeat();

  // Handle score adjustments (+ / - buttons)
  const handleScoreChange = (category: keyof BallotScores, delta: number) => {
    if (!activeJudge || isSubmitted) return;

    setDraftBallots(prev => prev.map(b => {
      if (b.team === selectedTeam && b.seat === selectedSeat) {
        const currentScore = b.scores[category];
        const newScore = Math.min(10, Math.max(1, currentScore + delta));
        return {
          ...b,
          scores: {
            ...b.scores,
            [category]: newScore
          }
        };
      }
      return b;
    }));
  };

  // Handle note typing
  const handleNotesChange = (newNotes: string) => {
    if (!activeJudge || isSubmitted) return;
    setSaveStatus('saving');

    setDraftBallots(prev => prev.map(b => {
      if (b.team === selectedTeam && b.seat === selectedSeat) {
        return {
          ...b,
          notes: newNotes
        };
      }
      return b;
    }));
    
    setSaveStatus('saved');
  };

  // Handle penalty adjustments
  const handlePenaltyChange = (delta: number) => {
    if (!activeJudge || isSubmitted) return;

    setDraftBallots(prev => prev.map(b => {
      if (b.team === selectedTeam && b.seat === selectedSeat) {
        const currentPenalties = b.penalties || 0;
        const newPenalties = Math.max(0, currentPenalties + delta);
        return {
          ...b,
          penalties: newPenalties
        };
      }
      return b;
    }));
  };

  // Reset active seat's ballot back to defaults (5 points, empty notes, 0 penalties)
  const handleResetActiveSeat = () => {
    if (!activeJudge || isSubmitted) return;

    setDraftBallots(prev => prev.map(b => {
      if (b.team === selectedTeam && b.seat === selectedSeat) {
        return {
          ...b,
          scores: { ...DEFAULT_SCORES },
          notes: '',
          penalties: 0
        };
      }
      return b;
    }));
  };

  // Submit all scores to server
  const handleSubmitScores = async () => {
    if (!activeJudge) return;

    try {
      const res = await fetch('/api/judges/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judgeId: activeJudge.id,
          ballots: draftBallots
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          onStateUpdate(data.state);
        }
        setShowSubmitConfirm(false);
      } else {
        console.error('Failed to submit scores:', await res.text());
      }
    } catch (err) {
      console.error('Error submitting scores:', err);
    }
  };

  // Winner decision countdown timer effect
  useEffect(() => {
    if (!state.winnerAutoSubmitDeadline || isSubmitted) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((state.winnerAutoSubmitDeadline! - Date.now()) / 1000));
      setTimerSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmitScores();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.winnerAutoSubmitDeadline, isSubmitted, draftBallots, activeJudge]);

  // Calculated Ballot metrics
  const ballotScoresTotal = currentBallot
    ? (Object.values(currentBallot.scores) as number[]).reduce((a: number, b: number) => Number(a) + Number(b), 0)
    : 55;
  const netBallotTotal = Math.max(0, Number(ballotScoresTotal) - (Number(currentBallot?.penalties) || 0));

  // LOGIN SCREEN
  if (!activeJudge) {
    return (
      <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative backdrop glow */}
        <div className="absolute w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl -top-40 -left-40 pointer-events-none"></div>
        <div className="absolute w-[500px] h-[500px] bg-[#f97316]/5 rounded-full blur-3xl -bottom-40 -right-40 pointer-events-none"></div>

        <div className="w-full max-w-lg bg-[#101114] border border-[#1d1e24] rounded-2xl p-8 shadow-2xl relative flex flex-col gap-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
              <Gavel className="w-6 h-6 text-[#60a5fa]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Totality Talk</h1>
              <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase mt-0.5">Human Decision Scorecard</p>
            </div>
          </div>

          {showSignUpForm ? (
            // --- SIGN UP APPLICATION FORM ---
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
                <span className="text-xs font-black text-white uppercase tracking-wider">Submit Judge Application</span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSignUpForm(false);
                    setSignUpStatus('idle');
                    setSignUpMessage('');
                  }}
                  className="text-xs text-gray-400 hover:text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>
              </div>

              {signUpStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">Application Submitted!</h4>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    {signUpMessage || "Your judge application has been successfully sent to the debate host for review. Once approved, you can log in using your judge nickname and password."}
                  </p>
                  <button
                    onClick={() => {
                      setShowSignUpForm(false);
                      setSignUpStatus('idle');
                      setSignUpMessage('');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-all cursor-pointer mt-2"
                  >
                    Return to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJudgeSignUpSubmit} className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
                  {signUpStatus === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-medium leading-relaxed">
                      {signUpMessage}
                    </div>
                  )}

                  {/* Judge Credentials & Age Verification */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-[#16171d]/60 border border-[#2d2f39] p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-black">1</span>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Judge Identification & Credentials</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Judge Nickname / Stage Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Judge Sarah"
                            value={signUpNickname}
                            onChange={(e) => setSignUpNickname(e.target.value)}
                            className="bg-[#101114] border border-[#2d2f39] text-xs text-white placeholder-gray-500 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                          />
                        </div>

                        {/* Birth Year Age Verification Dropdown */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Year Born (Age Verification)</label>
                          <select
                            required
                            value={signUpBirthYear}
                            onChange={(e) => setSignUpBirthYear(e.target.value)}
                            className="bg-[#101114] border border-[#2d2f39] text-xs text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                          >
                            <option value="">Select Birth Year...</option>
                            {Array.from({ length: 90 }, (_, i) => currentYear - i).map(year => (
                              <option key={year} value={year}>
                                {year} (Age {currentYear - year})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <span className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                        Evaluators must be at least 21 years of age. Applications from individuals under 21 will be automatically declined.
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Console Login Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            className="bg-[#101114] border border-[#2d2f39] text-xs text-white placeholder-gray-500 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Confirm Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={signUpConfirmPassword}
                            onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                            className="bg-[#101114] border border-[#2d2f39] text-xs text-white placeholder-gray-500 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-[#1d1e24] my-1"></div>

                  {/* Screening Questions */}
                  <div className="flex flex-col gap-3.5">
                    <div className="text-[10px] font-extrabold text-[#34d399] uppercase tracking-wider">Screening & Evaluation Profile</div>

                    {/* Question 1 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-300">1. When evaluating a claim, what influences your opinion the most?</label>
                      <select
                        required
                        value={signUpQ1}
                        onChange={(e) => setSignUpQ1(e.target.value)}
                        className="bg-[#16171d] border border-[#2d2f39] text-xs text-gray-300 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Select an answer...</option>
                        <option value="Strong, independently verifiable evidence.">Strong, independently verifiable evidence.</option>
                        <option value="Agreement among qualified experts and trusted sources.">Agreement among qualified experts and trusted sources.</option>
                        <option value="My own reasoning and intuition.">My own reasoning and intuition.</option>
                        <option value="I'd rather not answer.">I'd rather not answer.</option>
                      </select>
                    </div>

                    {/* Question 2 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-300">2. What is most likely to change your mind?</label>
                      <select
                        required
                        value={signUpQ2}
                        onChange={(e) => setSignUpQ2(e.target.value)}
                        className="bg-[#16171d] border border-[#2d2f39] text-xs text-gray-300 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Select an answer...</option>
                        <option value="Clear, repeatable evidence.">Clear, repeatable evidence.</option>
                        <option value="Broad expert agreement after careful review.">Broad expert agreement after careful review.</option>
                        <option value="Personal experience.">Personal experience.</option>
                        <option value="I'd rather not answer.">I'd rather not answer.</option>
                      </select>
                    </div>

                    {/* Question 3 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-300">3. During a debate, which should affect a judge's score?</label>
                      <select
                        required
                        value={signUpQ3}
                        onChange={(e) => setSignUpQ3(e.target.value)}
                        className="bg-[#16171d] border border-[#2d2f39] text-xs text-gray-300 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Select an answer...</option>
                        <option value="Only the quality of the arguments and evidence.">Only the quality of the arguments and evidence.</option>
                        <option value="The speaker's experience or reputation.">The speaker's experience or reputation.</option>
                        <option value="Whether I personally agree with the speaker's lifestyle or identity.">Whether I personally agree with the speaker's lifestyle or identity.</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3 border-t border-[#1d1e24] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSignUpForm(false);
                        setSignUpStatus('idle');
                        setSignUpMessage('');
                      }}
                      className="flex-1 border border-[#2d2f39] bg-[#16171d] hover:bg-[#20222b] text-gray-400 hover:text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={signUpStatus === 'submitting'}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black py-3 rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-colors shadow-lg shadow-emerald-600/10"
                    >
                      {signUpStatus === 'submitting' ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span>Submit Application</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            // --- LOGIN FORM ---
            <>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Please enter your assigned credentials from the Host desk settings to open your evaluator scorecard.
              </p>

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Judge Nickname / Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Judge Sarah"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Console Login Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      placeholder="Enter Console Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-600/10 mt-2"
                >
                  Enter Evaluator Console
                </button>

                <div className="flex items-center my-1.5">
                  <div className="flex-1 h-px bg-[#1d1e24]"></div>
                  <span className="px-3 text-[10px] text-gray-500 font-black uppercase tracking-wider">Or</span>
                  <div className="flex-1 h-px bg-[#1d1e24]"></div>
                </div>

                {state.currentPhase === 'LOBBY' ? (
                  <div className="text-center p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <p className="text-[11px] text-amber-500 font-semibold leading-relaxed">
                      Judge applications are only available during active debates.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignUpForm(true);
                      setSignUpNickname('');
                      setSignUpBirthYear('');
                      setSignUpPassword('');
                      setSignUpConfirmPassword('');
                      setSignUpQ1('');
                      setSignUpQ2('');
                      setSignUpQ3('');
                      setSignUpStatus('idle');
                      setSignUpMessage('');
                    }}
                    className="w-full bg-[#34d399]/10 hover:bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/20 font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Gavel className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Become a Judge</span>
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // ACTIVE SCORECARD SCREEN
  return (
    <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex flex-col relative overflow-x-hidden">
      
      {/* Decorative ambient glowing grids */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER BAR */}
      <header className="h-16 border-b border-[#1d1e24] bg-[#0c0d10] px-6 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f97316] flex items-center justify-center shadow-lg">
            {/* Scales/gavel outline design */}
            <Gavel className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-1.5">
              <span>TOTALITY TALK</span>
            </span>
            <p className="text-[9px] text-[#64748b] font-black tracking-widest uppercase">Human Decision Scorecard</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CONNECTED TO HOST</span>
          </div>

          <button 
            onClick={handleLogout}
            className="text-[10px] font-black text-[#64748b] hover:text-white uppercase transition-colors px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-transparent hover:border-[#2d2f39]"
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 flex flex-col gap-6 relative z-10 max-w-7xl mx-auto w-full">
        
        {/* CLOSING STATEMENTS FINALIZATION BANNER */}
        {(state.currentPhase || '').toUpperCase().includes('CLOSING') && !isSubmitted && (
          <div className="bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 border-2 border-amber-500 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h4 className="text-xs font-black text-amber-200 uppercase tracking-wider">
                  📣 Final Round Closing Statements Active
                </h4>
                <p className="text-[11px] text-gray-200 font-semibold leading-snug">
                  Please review your scores across all seats and finalize your scorecard before the host declares the official winner!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl uppercase tracking-wider transition-colors shrink-0 shadow-lg cursor-pointer"
            >
              Finalize & Submit Scorecard
            </button>
          </div>
        )}

        {/* TOP ROW HUD GRID: Banner & Authenticated Seat Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
          
          {/* BANNER CARD (8 cols) */}
          <section className="lg:col-span-8 bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#f97316]"></div>
            
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="inline-flex">
                <span className="bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316] text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                  LOBBY FEED TRANSMITTER ACTIVE
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                Hello, Judge {activeJudge.nickname || activeJudge.username}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mt-0.5">
                <span className="text-[#64748b] font-bold uppercase">Live Topic:</span>
                <span className="text-white truncate max-w-[400px]">"{state.settings?.debateTopic}"</span>
              </div>
            </div>

            {/* Banner controls */}
            <div className="flex items-center gap-2 shrink-0">
              {!isSubmitted && (
                <button
                  onClick={handleResetActiveSeat}
                  className="px-3.5 py-1.5 bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] text-[#ef4444] hover:text-red-400 font-black text-[10px] rounded-lg tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  Reset Active Seat
                </button>
              )}

              {!isSubmitted && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  <span>Submit Scores</span>
                </button>
              )}

              <div className="px-3 py-1.5 bg-[#16171d] border border-[#f97316]/20 text-[#f97316] font-black text-[10px] rounded-lg flex items-center gap-1.5">
                <span>JUDGES COM</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              </div>

              <button
                onClick={() => setExploreOpen(true)}
                className="px-4 py-1.5 bg-[#f97316]/10 hover:bg-[#f97316]/20 border border-[#f97316]/40 text-white font-black text-[10px] rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                Explore Claims & Evidence
              </button>
            </div>
          </section>

          {/* AUTHENTICATED SEAT BALLOT TOTAL (4 cols) */}
          <section className="lg:col-span-4 bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f97316] to-[#3b82f6]"></div>
            
            <div>
              <span className="text-[9px] font-black text-[#f97316] tracking-widest uppercase">Authenticated Seat</span>
              <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">Active Debate Evaluator</h3>
            </div>

            <div className="flex items-end justify-between mt-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-[#64748b] tracking-wider uppercase">Seat Ballot Total</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-4xl font-black text-white font-mono">{netBallotTotal}</span>
                  <span className="text-xs text-gray-500 font-semibold">/ 110 pts</span>
                </div>
              </div>

              {/* Perspective Indicator */}
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 rounded bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 uppercase">
                  {selectedTeam === 'PROPOSER' ? 'AFF' : 'OPP'} S{selectedSeat}: {netBallotTotal}/110
                </span>
              </div>
            </div>
          </section>

        </div>

        {/* TEAM & SEAT SELECTION SECTOR */}
        <section className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Affirmative Team Seating */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[#1d1e24] pb-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-[#f97316] tracking-widest uppercase">{state.settings?.proTeamName || 'Affirmative'}</span>
                  <h4 className="text-xs font-black text-white uppercase">Seated Panel</h4>
                </div>
                <span className="text-[9px] text-gray-500 font-semibold uppercase">Select Active Seat</span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: state.settings?.proSeatsCount ?? 3 }, (_, i) => i + 1).map((seatNum) => {
                  const part = getParticipantForSeat('PROPOSER', seatNum);
                  const isSelected = selectedTeam === 'PROPOSER' && selectedSeat === seatNum;
                  return (
                    <button
                      key={`pro-seat-${seatNum}`}
                      onClick={() => {
                        setSelectedTeam('PROPOSER');
                        setSelectedSeat(seatNum);
                      }}
                      className={`flex flex-col p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-[#f97316]/10 border-[#f97316] shadow-lg shadow-[#f97316]/5 text-white'
                          : 'bg-[#16171d]/60 border-[#1d1e24] hover:border-[#2d2f39] text-gray-400'
                      }`}
                    >
                      <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-[#f97316]' : 'text-gray-500'}`}>
                        Seat {seatNum}
                      </span>
                      <span className="text-[10px] font-bold truncate mt-1">
                        {part ? part.name : '[Empty]'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opposition Team Seating */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[#1d1e24] pb-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-[#60a5fa] tracking-widest uppercase">{state.settings?.conTeamName || 'Opposition'}</span>
                  <h4 className="text-xs font-black text-white uppercase">Seated Panel</h4>
                </div>
                <span className="text-[9px] text-gray-500 font-semibold uppercase">Select Active Seat</span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: state.settings?.conSeatsCount ?? 3 }, (_, i) => i + 1).map((seatNum) => {
                  const part = getParticipantForSeat('CONTRARY', seatNum);
                  const isSelected = selectedTeam === 'CONTRARY' && selectedSeat === seatNum;
                  return (
                    <button
                      key={`con-seat-${seatNum}`}
                      onClick={() => {
                        setSelectedTeam('CONTRARY');
                        setSelectedSeat(seatNum);
                      }}
                      className={`flex flex-col p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/5 text-white'
                          : 'bg-[#16171d]/60 border-[#1d1e24] hover:border-[#2d2f39] text-gray-400'
                      }`}
                    >
                      <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>
                        Seat {seatNum}
                      </span>
                      <span className="text-[10px] font-bold truncate mt-1">
                        {part ? part.name : '[Empty]'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Seat Occupant History across rounds */}
            {(() => {
              const history = (state.seatHistory || []).filter(
                h => h.team === selectedTeam && h.seat === selectedSeat
              );
              return (
                <div className="bg-[#16171d]/80 border border-[#2d2f39] rounded-xl p-3 flex flex-col gap-2 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                      Seat {selectedSeat} Panelist History ({selectedTeam === 'PROPOSER' ? 'AFF' : 'OPP'})
                    </span>
                    <span className="text-[9px] font-mono text-blue-400 font-extrabold">
                      {history.length} Occupant(s)
                    </span>
                  </div>

                  {history.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {history.map((h, idx) => (
                        <span key={idx} className="text-[10px] bg-black/40 border border-[#2d2f39] text-gray-300 px-2 py-1 rounded font-semibold flex items-center gap-1">
                          <span className="text-gray-500 font-mono text-[9px]">{h.round}:</span>
                          <span className="text-white font-bold">{h.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 italic">
                      Evaluating Seat {selectedSeat} overall performance across all debate rounds.
                    </span>
                  )}
                </div>
              );
            })()}

          </div>
        </section>

        {/* THREE CORE CARD CATEGORIES */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* SECTION 1: ARGUMENT EVALUATION */}
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#1d1e24] pb-3 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#f97316] text-white flex items-center justify-center text-xs font-black">
                1
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Argument Evaluation</h3>
                <p className="text-[10px] text-gray-500">Evaluate macro logic, reasoning depth, and conversational flow</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { key: 'reasoning', label: 'Strength of reasoning' },
                { key: 'consistency', label: 'Logical consistency' },
                { key: 'respond', label: 'Ability to respond' },
                { key: 'persuasiveness', label: 'Overall persuasiveness' }
              ].map((item) => {
                const scoreVal = currentBallot ? currentBallot.scores[item.key as keyof BallotScores] : 5;
                return (
                  <div key={item.key} className="flex items-center justify-between bg-[#16171d]/50 p-2.5 rounded-xl border border-[#2d2f39]/20">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">Rate 1 to 10</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, -1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      <div className="w-8 flex flex-col items-center">
                        <span className="font-mono text-sm font-black text-white">{scoreVal}</span>
                        <span className="text-[8px] text-gray-500 font-semibold uppercase -mt-0.5">pts</span>
                      </div>

                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, 1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: CLAIM EVALUATION */}
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#1d1e24] pb-3 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#f97316] text-white flex items-center justify-center text-xs font-black">
                2
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Claim Evaluation</h3>
                <p className="text-[10px] text-gray-500">Assess statement of facts, clarity, and structural consistency</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { key: 'clarity', label: 'Clarity of the claim' },
                { key: 'supported', label: 'Whether claim is supported' },
                { key: 'contradiction', label: 'Contradiction check' }
              ].map((item) => {
                const scoreVal = currentBallot ? currentBallot.scores[item.key as keyof BallotScores] : 5;
                return (
                  <div key={item.key} className="flex items-center justify-between bg-[#16171d]/50 p-2.5 rounded-xl border border-[#2d2f39]/20">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">Rate 1 to 10</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, -1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      <div className="w-8 flex flex-col items-center">
                        <span className="font-mono text-sm font-black text-white">{scoreVal}</span>
                        <span className="text-[8px] text-gray-500 font-semibold uppercase -mt-0.5">pts</span>
                      </div>

                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, 1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: DEBATE PERFORMANCE */}
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#1d1e24] pb-3 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#f97316] text-white flex items-center justify-center text-xs font-black">
                3
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Debate Performance</h3>
                <p className="text-[10px] text-gray-500">Observe behavioral ethics, rules commitment, and tone</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { key: 'rules', label: 'Following debate rules' },
                { key: 'topic', label: 'Staying on topic' },
                { key: 'questions', label: 'Answering questions directly' },
                { key: 'respectful', label: 'Respectful communication' }
              ].map((item) => {
                const scoreVal = currentBallot ? currentBallot.scores[item.key as keyof BallotScores] : 5;
                return (
                  <div key={item.key} className="flex items-center justify-between bg-[#16171d]/50 p-2.5 rounded-xl border border-[#2d2f39]/20">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">Rate 1 to 10</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, -1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      <div className="w-8 flex flex-col items-center">
                        <span className="font-mono text-sm font-black text-white">{scoreVal}</span>
                        <span className="text-[8px] text-gray-500 font-semibold uppercase -mt-0.5">pts</span>
                      </div>

                      <button
                        onClick={() => handleScoreChange(item.key as keyof BallotScores, 1)}
                        disabled={isSubmitted}
                        className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f97316]/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER BAR */}
      <footer className="h-10 bg-[#07080a] border-t border-[#1d1e24] px-4 flex items-center justify-center text-[10px] text-[#64748b] font-bold tracking-widest uppercase shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>ALL BALLOT UPDATES LIVE SAVED</span>
        </div>
      </footer>

      {/* EXPLORE SIDE PANEL (Claims & Evidence, Notes, Penalties) */}
      {exploreOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#101114] border-l border-[#1d1e24] h-full flex flex-col shadow-2xl relative">
            
            {/* Slide heading */}
            <div className="h-16 border-b border-[#1d1e24] px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#f97316]" />
                <h3 className="font-black text-xs uppercase tracking-wider text-white">Claims & Evidence Room</h3>
              </div>
              <button
                onClick={() => setExploreOpen(false)}
                className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              {/* Active topic & phase */}
              <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-[#f97316] uppercase tracking-wider">Live debate context</span>
                  <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                    PHASE: {state.currentPhase}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">"{state.settings?.debateTopic}"</p>
              </div>

              {/* Penalties interface */}
              <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-3">
                <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">Deductions / Penalties</span>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Apply negative compliance or behavior points to the selected evaluator seat. These subtract directly from the Seat Ballot Total.
                </p>
                <div className="flex items-center justify-between bg-[#0d0e12] p-3 rounded-lg border border-[#2d2f39]/50 mt-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Active Penalty Points</span>
                    <span className="text-[9px] text-gray-500 mt-0.5">Deducted from S{selectedSeat} total</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePenaltyChange(-1)}
                      disabled={isSubmitted}
                      className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-red-500/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-sm font-black text-red-500 px-2">
                      -{currentBallot?.penalties || 0}
                    </span>
                    <button
                      onClick={() => handlePenaltyChange(1)}
                      disabled={isSubmitted}
                      className={`w-7 h-7 rounded bg-[#16171d] border border-[#2d2f39] flex items-center justify-center text-gray-400 hover:text-white hover:border-red-500/50 transition-all cursor-pointer ${isSubmitted ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:border-[#2d2f39]' : ''}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Note / Writeup editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Notes & Evaluation writeup</span>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    isSubmitted ? 'bg-blue-500 text-white animate-pulse' : saveStatus === 'saved' ? 'bg-emerald-500/10 text-emerald-400' : saveStatus === 'saving' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {isSubmitted ? 'SUBMITTED & LOCKED' : saveStatus === 'saved' ? 'SAVED TO DRAFT' : saveStatus === 'saving' ? 'SAVING DRAFT...' : 'SAVE ERROR'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={currentBallot?.notes || ''}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Record your evaluator notes, strengths, and critique points for this participant..."
                  className={`w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white p-3.5 rounded-xl focus:outline-none focus:border-[#f97316] font-semibold leading-relaxed resize-none ${isSubmitted ? 'opacity-60 cursor-not-allowed focus:border-[#2d2f39]' : ''}`}
                />
              </div>

              {/* Claims & evidence List */}
              <div className="flex flex-col gap-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Claims list</span>
                
                {state.formalClaims && state.formalClaims.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {state.formalClaims.map((claim) => (
                      <div key={claim.claimId} className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            claim.team === 'PROPOSER' ? 'bg-[#f97316]/10 text-[#f97316]' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {claim.speaker} ({claim.team === 'PROPOSER' ? 'AFF' : 'OPP'})
                          </span>
                          <span className="text-[9px] text-gray-500 font-semibold">{claim.phase}</span>
                        </div>
                        <p className="text-xs font-semibold text-white leading-relaxed">"{claim.claimText}"</p>
                        <ClaimVisualButton
                          claim={claim}
                          updateStateOnServer={(updaterOrObj) => {
                            if (typeof updaterOrObj === 'function') {
                              const res = updaterOrObj(state);
                              if (res) onStateUpdate({ ...state, ...res });
                            } else if (updaterOrObj) {
                              onStateUpdate({ ...state, ...updaterOrObj });
                            }
                          }}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-[#2d2f39] rounded-xl p-6 text-center text-gray-500 text-xs">
                    No claims submitted during this debate yet.
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="h-20 border-t border-[#1d1e24] bg-[#0c0d10] px-6 flex items-center gap-3 shrink-0">
              <button
                onClick={() => setExploreOpen(false)}
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold text-xs py-3.5 rounded-xl uppercase tracking-wider transition-colors text-center cursor-pointer shadow-lg shadow-[#f97316]/10"
              >
                Return to Ballot
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation modal for submitting scores */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#101114] border border-[#1d1e24] rounded-2xl p-6 shadow-2xl relative flex flex-col gap-5">
            <div className="flex items-center gap-3 text-[#ef4444]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-white tracking-tight">Submit all scores for this round?</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed">
              Once confirmed, your draft scores and evaluation notes for all active seats will be submitted and locked. You will not be able to make any changes unless reopened by the host.
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] text-gray-400 hover:text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitScores}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center shadow-md shadow-emerald-600/10"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Declaration Auto-Submit 1-Minute Timer Pop-up */}
      {state.winnerAutoSubmitDeadline && !isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#101114] border-2 border-red-500/80 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-5 text-center animate-bounce-short">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7 text-red-400 animate-spin-slow" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                ⚠️ Host Has Initiated Winner Selection
              </span>
              <h3 className="text-lg font-black text-white">
                Submit Your Scores Before Time Expires!
              </h3>
              <p className="text-xs text-gray-300 font-medium leading-relaxed">
                The host is finalizing debate results. You have <strong className="text-red-400 font-mono text-base">{timerSeconds}s</strong> to review and submit your final scores.
              </p>
              <p className="text-[10px] text-gray-400 italic">
                If you do not submit before the countdown finishes, your current scores will be submitted automatically so the debate winner can be calculated.
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleSubmitScores}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Submit Final Scores Now ({timerSeconds}s)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
