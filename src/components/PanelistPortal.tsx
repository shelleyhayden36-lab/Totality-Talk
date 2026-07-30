import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Send, 
  Check, 
  X, 
  Gavel, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  ThumbsUp, 
  Link2, 
  User, 
  FileText,
  HelpCircle,
  Trophy,
  Lightbulb,
  MessageSquare,
  Target,
  ShieldAlert,
  Award,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { DebateState, FormalClaim, Evidence, DEFAULT_DEBATE_RULES } from '../App';

interface PanelistPortalProps {
  state: DebateState;
  onStateUpdate: (updatedState: Partial<DebateState>) => void;
}

export default function PanelistPortal({ state, onStateUpdate }: PanelistPortalProps) {
  // Try retrieving session credentials from sessionStorage for high-fidelity cross-device/refresh behavior
  const [myTikTokName, setMyTikTokName] = useState(() => {
    return sessionStorage.getItem('tt_panelist_name') || '';
  });
  const [myTeam, setMyTeam] = useState<'PROPOSER' | 'CONTRARY' | null>(() => {
    const saved = sessionStorage.getItem('tt_panelist_team');
    return (saved === 'PROPOSER' || saved === 'CONTRARY') ? saved : null;
  });

  // Login form temporary states
  const [tempName, setTempName] = useState('');
  const [tempTeam, setTempTeam] = useState<'PROPOSER' | 'CONTRARY' | null>(null);

  // Form states for active desk
  const [claimText, setClaimText] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceSource, setEvidenceSource] = useState('');
  const [linkedClaimId, setLinkedClaimId] = useState('');
  const [counterText, setCounterText] = useState('');
  const [targetClaimId, setTargetClaimId] = useState('');

  // Status/Alert messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showWinnerPopup, setShowWinnerPopup] = useState(true);

  // Ground Rules popup & agreement state
  const [showGroundRulesModal, setShowGroundRulesModal] = useState(false);
  const [agreedToRules, setAgreedToRules] = useState(() => {
    if (!myTikTokName) return false;
    return localStorage.getItem(`agreed_rules_${myTikTokName.toLowerCase()}`) === 'true';
  });
  const [agreedCheckbox, setAgreedCheckbox] = useState(false);
  const [hasAutoOpenedRules, setHasAutoOpenedRules] = useState(false);

  // Check our participant status from the synchronized state
  const myParticipant = (state.participants || []).find(
    p => p.name.toLowerCase() === myTikTokName.toLowerCase()
  );

  // Auto-open ground rules popup on first seating if not yet agreed
  useEffect(() => {
    if (myTikTokName && myParticipant && myParticipant.status !== 'pending' && !agreedToRules && !hasAutoOpenedRules) {
      setAgreedCheckbox(false);
      setShowGroundRulesModal(true);
      setHasAutoOpenedRules(true);
    }
  }, [myTikTokName, myParticipant, agreedToRules, hasAutoOpenedRules]);

  // Auto-clear messages
  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, errorMsg]);

  // Re-open winner popup if phase changes to FINISHED or declaredWinner is set
  useEffect(() => {
    if (state.currentPhase === 'FINISHED' || state.declaredWinner) {
      setShowWinnerPopup(true);
    }
  }, [state.currentPhase, state.declaredWinner]);

  // Auto-logout when debate is reset by host
  useEffect(() => {
    if (myTikTokName) {
      const isSeated = (state.participants || []).some(
        p => p.name.toLowerCase() === myTikTokName.toLowerCase()
      );
      if (!isSeated) {
        sessionStorage.removeItem('tt_panelist_name');
        sessionStorage.removeItem('tt_panelist_team');
        setMyTikTokName('');
        setMyTeam(null);
      }
    }
  }, [state.participants, state.resetTimestamp]);

  // Trigger background register/poll on mount or name change
  useEffect(() => {
    if (myTikTokName && myTeam) {
      fetch('/api/participants/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myTikTokName, role: myTeam })
      })
      .then(res => {
        if (res.ok) {
          return res.json();
        }
      })
      .then(data => {
        if (data && data.state) {
          onStateUpdate(data.state);
        }
      })
      .catch(err => {
        console.error('Error auto-joining:', err);
      });
    }
  }, [myTikTokName, myTeam]);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!tempName.trim()) {
      setErrorMsg('Please enter your TikTok username');
      return;
    }
    if (!tempTeam) {
      setErrorMsg('Please select a team assignment');
      return;
    }

    const formattedName = tempName.trim().startsWith('@') ? tempName.trim() : `@${tempName.trim()}`;

    try {
      const res = await fetch('/api/participants/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formattedName, role: tempTeam })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to enter team.');
        return;
      }

      setMyTikTokName(formattedName);
      setMyTeam(tempTeam);
      sessionStorage.setItem('tt_panelist_name', formattedName);
      sessionStorage.setItem('tt_panelist_team', tempTeam);
      
      onStateUpdate(data.state);
      setSuccessMsg(`Welcome, ${formattedName}! Registered successfully.`);
    } catch (err) {
      console.error('Error joining team:', err);
      setErrorMsg('Network error registering with server. Please try again.');
    }
  };

  // Handle Logout / Reset
  const handleLogout = async () => {
    if (myTikTokName) {
      try {
        await fetch('/api/participants/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: myTikTokName })
        });
      } catch (err) {
        console.error('Error removing participant on logout:', err);
      }
    }
    setMyTikTokName('');
    setMyTeam(null);
    sessionStorage.removeItem('tt_panelist_name');
    sessionStorage.removeItem('tt_panelist_team');
  };

  // Submit Claim to Server
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimText.trim()) return;

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker: myTikTokName,
          speakerId: `panelist-${myTikTokName.replace('@', '')}`,
          team: myTeam,
          phase: state.currentPhase,
          claimText: claimText.trim(),
          status: 'pending' // Enters Host Desk queue
        })
      });

      if (res.ok) {
        setClaimText('');
        setSuccessMsg('Claim submitted successfully! Waiting for host desk approval.');
        // Trigger a background poll/refresh by updating local state representation
        const data = await res.json();
        onStateUpdate(data);
      } else {
        setErrorMsg('Failed to submit claim. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting claim:', err);
      setErrorMsg('Network error submitting claim.');
    }
  };

  // Submit Evidence to Server
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceText.trim()) {
      setErrorMsg('Evidence statement is required');
      return;
    }
    if (!linkedClaimId) {
      setErrorMsg('You must link this evidence to a claim');
      return;
    }

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: linkedClaimId,
          submittedBy: myTikTokName,
          evidenceText: evidenceText.trim(),
          source: evidenceSource.trim() || 'Unspecified Source',
          status: 'pending' // Enters review queue
        })
      });

      if (res.ok) {
        setEvidenceText('');
        setEvidenceSource('');
        setSuccessMsg('Evidence filed successfully! Sent to review queue.');
        const data = await res.json();
        onStateUpdate(data);
      } else {
        setErrorMsg('Failed to submit evidence. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting evidence:', err);
      setErrorMsg('Network error submitting evidence.');
    }
  };

  // Submit Counterclaim to Server
  const handleSubmitCounterClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterText.trim()) {
      setErrorMsg('Counterclaim statement is required');
      return;
    }
    if (!targetClaimId) {
      setErrorMsg('You must select a claim to counter');
      return;
    }

    // Enforce counterclaim limit: Max 2 counterclaims total per seat per round
    const myRoundCCs = (state.counterClaims || []).filter(
      cc => cc.rebutterId === myTikTokName && (cc.round ? cc.round === state.currentRound : true)
    );
    if (myRoundCCs.length >= 2) {
      setErrorMsg(`Counterclaim limit reached: You have used your max 2 counterclaims for ${state.currentRound || 'this round'}.`);
      return;
    }

    try {
      const res = await fetch('/api/counterclaims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: targetClaimId,
          rebutterId: myTikTokName,
          counterText: counterText.trim(),
          round: state.currentRound || 'Round 1'
        })
      });

      if (res.ok) {
        setCounterText('');
        setSuccessMsg('Counterclaim submitted successfully!');
        const data = await res.json();
        onStateUpdate(data);
      } else {
        setErrorMsg('Failed to submit counterclaim. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting counterclaim:', err);
      setErrorMsg('Network error submitting counterclaim.');
    }
  };

  // Second / Support a Team Claim
  const handleSecondClaim = async (claimToSecond: FormalClaim) => {
    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claimToSecond.claimId,
          submittedBy: myTikTokName,
          evidenceText: `[Seconded by Seat ${mySeatNumber} ${myTikTokName}] Endorsing and adding full support to this team claim.`,
          source: `Seat ${mySeatNumber} Team Endorsement`,
          status: 'approved'
        })
      });

      if (res.ok) {
        setSuccessMsg(`Successfully seconded team claim: "${claimToSecond.claimText.slice(0, 35)}..."`);
        const data = await res.json();
        onStateUpdate(data);
      } else {
        setErrorMsg('Failed to second claim. Please try again.');
      }
    } catch (err) {
      console.error('Error seconding claim:', err);
      setErrorMsg('Network error seconding claim.');
    }
  };

  // Get only approved claims that are available to link evidence to
  const availableClaims = (state.formalClaims || []).filter(c => c.status === 'approved');

  // Calculate my seat number
  const myTeamMembers = (state.participants || []).filter(
    p => p.role === myTeam && p.isSeated && p.status !== 'pending'
  );
  const mySeatIdx = myTeamMembers.findIndex(
    p => p.name.toLowerCase() === myTikTokName.toLowerCase()
  );
  const mySeatNumber = mySeatIdx !== -1 ? mySeatIdx + 1 : 1;

  // Track round counterclaims used by this panelist seat
  const myRoundCCsCount = (state.counterClaims || []).filter(
    cc => cc.rebutterId === myTikTokName && (cc.round ? cc.round === state.currentRound : true)
  ).length;

  // Helper formatting for timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter submissions made by this user
  const myClaims = (state.formalClaims || []).filter(c => c.speaker === myTikTokName);
  const myEvidenceList = (state.evidenceList || []).filter(e => e.submittedBy === myTikTokName);
  const myCounterClaims = (state.counterClaims || []).filter(cc => cc.rebutterId === myTikTokName);

  // My team claims available to second
  const myTeamClaims = (state.formalClaims || []).filter(c => c.status === 'approved' && c.team === myTeam);

  // Get only approved claims from the opposing team to counter
  const opposingClaims = (state.formalClaims || []).filter(c => c.status === 'approved' && c.team !== myTeam);

  if (!myTikTokName || !myTeam) {
    // ONBOARDING LOGIN SCREEN
    return (
      <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#101114] border border-[#1d1e24] rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5">
          {/* Subtle brand glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#f97316] to-transparent"></div>

          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center mb-3">
              <Radio className="w-6 h-6 text-[#f97316] animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">TOTALITY TALK</h1>
            <p className="text-xs text-gray-400 mt-1">Panelist Portal Registration</p>
          </div>

          {/* Active Topic Banner */}
          <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-1 text-center">
            <span className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">Active Debate Topic</span>
            <p className="text-xs font-bold text-white leading-relaxed">
              "{state.settings?.debateTopic || 'Should social media platforms be legally held liable for user-generated content?'}"
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">your TikTok user</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">@</span>
                <input
                  type="text"
                  required
                  placeholder="TikTok name"
                  value={tempName.replace('@', '')}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white pl-7 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#f97316] font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Select Team Assignment</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTempTeam('PROPOSER')}
                  className={`py-3 rounded-xl text-xs font-black border flex flex-col items-center justify-center gap-1 transition-all ${
                    tempTeam === 'PROPOSER'
                      ? 'bg-[#f97316]/15 border-[#f97316] text-[#f97316] shadow-[0_2px_12px_rgba(249,115,22,0.1)]'
                      : 'bg-[#16171d] border-[#2d2f39] text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] tracking-widest font-black uppercase">{state.settings?.proTeamName || 'Affirmative'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTempTeam('CONTRARY')}
                  className={`py-3 rounded-xl text-xs font-black border flex flex-col items-center justify-center gap-1 transition-all ${
                    tempTeam === 'CONTRARY'
                      ? 'bg-red-500/15 border-red-500 text-red-400 shadow-[0_2px_12px_rgba(239,68,68,0.1)]'
                      : 'bg-[#16171d] border-[#2d2f39] text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] tracking-widest font-black uppercase">{state.settings?.conTeamName || 'Opposition'}</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold text-xs py-3.5 rounded-xl uppercase tracking-wider cursor-pointer transition-colors shadow-lg shadow-[#f97316]/15 mt-2"
            >
              Enter Panelist Desk
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If we are logged in but pending or denied by the host, display appropriate screens
  if (myTikTokName && myTeam) {
    const isStateLoaded = state.participants !== undefined;
    
    // Check if state is loaded, and if we are not found in the participants array.
    // That means we submitted registration but were denied or removed by the host.
    if (isStateLoaded && !myParticipant) {
      return (
        <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#101114] border border-[#1d1e24] rounded-2xl p-6 shadow-2xl relative text-center flex flex-col gap-5">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
            <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-1">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Access Declined</h1>
            <p className="text-xs text-gray-400">
              Your request was declined or you were removed from the team spots by the Host.
            </p>
            <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[9px] font-black tracking-widest text-red-400 uppercase">TikTok Handle</span>
              <p className="text-sm font-extrabold text-white">{myTikTokName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] text-gray-300 font-bold text-xs py-3 rounded-xl uppercase transition-colors"
            >
              Change Username / Try Again
            </button>
          </div>
        </div>
      );
    }

    if (myParticipant?.status === 'pending') {
      return (
        <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#101114] border border-[#1d1e24] rounded-2xl p-6 shadow-2xl relative text-center flex flex-col gap-5 animate-pulse">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#f97316] to-transparent"></div>
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center mb-1">
              <Radio className="w-6 h-6 text-[#f97316] animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Spot Pending Approval</h1>
            <p className="text-xs text-gray-400">
              You are in line for the next available spot on the{' '}
              <span className={myTeam === 'PROPOSER' ? 'text-[#f97316] font-black' : 'text-red-400 font-black'}>
                {myTeam === 'PROPOSER' ? (state.settings?.proTeamName || 'Affirmative') : (state.settings?.conTeamName || 'Opposition')}
              </span>
              .
            </p>
            <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">Registration Handle</span>
              <p className="text-sm font-extrabold text-white">{myTikTokName}</p>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold leading-relaxed px-4">
              The Host dashboard shows your request as pending. Once approved, your panelist desk controls will automatically unlock here.
            </p>
            <button
              onClick={handleLogout}
              className="w-full bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] text-gray-400 text-[10px] font-bold py-2.5 rounded-lg uppercase transition-colors"
            >
              Cancel Request & Leave
            </button>
          </div>
        </div>
      );
    }
  }

  // ACTIVE PANELIST PORTAL
  return (
    <div className="min-h-screen bg-[#07080a] text-[#f3f4f6] font-sans flex flex-col">
      {/* Top Header Panel */}
      <header className="h-14 bg-[#101114] border-b border-[#1d1e24] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#f97316] animate-pulse" />
            <span className="font-sans font-black tracking-wider text-sm text-white">PANELIST PORTAL</span>
          </div>
          <div className="h-4 w-px bg-[#2d2f39]"></div>
          <span className="text-[11px] text-[#64748b] font-mono font-bold uppercase hidden sm:inline">
            {state.currentRound} · {state.currentPhase}
          </span>
        </div>

        {/* Sync Indicator, Rules Button, and Timer */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Small Ground Rules Button */}
          <button
            type="button"
            onClick={() => {
              setAgreedCheckbox(agreedToRules);
              setShowGroundRulesModal(true);
            }}
            className="px-2.5 py-1.5 bg-[#16171d] hover:bg-[#20222b] text-gray-300 hover:text-white border border-[#2d2f39] hover:border-[#f97316]/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
            title="View Debate Ground Rules"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#f97316]" />
            <span className="hidden sm:inline">Ground Rules</span>
            <span className="sm:hidden">Rules</span>
            {agreedToRules && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
          </button>

          <div className="flex items-center gap-2.5 bg-[#16171d] border border-[#2d2f39] px-3.5 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-mono text-xs font-extrabold text-[#f97316]">
              {formatTime(state.timer.timeLeft)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f97316]"></span>
              <span className="text-xs font-black text-white">{myTikTokName}</span>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
              myTeam === 'PROPOSER' 
                ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {myTeam === 'PROPOSER' ? (state.settings?.proTeamName || 'Affirmative') : (state.settings?.conTeamName || 'Opposition')}
            </span>
            <button 
              onClick={handleLogout}
              className="text-[10px] font-bold text-gray-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-[#2d2f39] px-2 py-1 rounded transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel Content Scroll */}
      <main className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full flex flex-col gap-5">
        
        {/* Status Messages */}
        {successMsg && (
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl p-3 text-xs font-semibold flex items-center gap-2 transition-all">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl p-3 text-xs font-semibold flex items-center gap-2 transition-all">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current Debate Topic Card */}
        <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#f97316]"></div>
          
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase">Current Debate Prompt</span>
            
            <button
              type="button"
              onClick={() => {
                setAgreedCheckbox(agreedToRules);
                setShowGroundRulesModal(true);
              }}
              className="px-2.5 py-1 bg-[#16171d] hover:bg-[#252733] text-gray-300 hover:text-white border border-[#2d2f39] hover:border-[#f97316]/50 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Review Debate Ground Rules"
            >
              <Gavel className="w-3.5 h-3.5 text-[#f97316]" />
              <span>Ground Rules</span>
              {agreedToRules ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse"></span>
              )}
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-black text-white leading-relaxed">
            "{state.settings?.debateTopic || 'Should social media platforms be legally held liable for user-generated content?'}"
          </h2>
          <div className="flex items-center gap-4 mt-3 text-[11px] font-semibold text-[#64748b]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Debate Status: Active</span>
            </div>
            <span>·</span>
            <span>Host Desk is listening</span>
          </div>
        </div>

        {/* Dynamic Round & Phase Guidance Banner */}
        {(() => {
          const phaseUpper = (state.currentPhase || '').toUpperCase();
          const isLobby = phaseUpper.includes('SETUP') || phaseUpper.includes('LOBBY') || phaseUpper === 'IDLE';
          const isOpening = phaseUpper.includes('OPENING');
          const isCrossExam = phaseUpper.includes('CROSS') || phaseUpper.includes('EXAM');
          const isRebuttal = phaseUpper.includes('REBUT');
          const isClosing = phaseUpper.includes('CLOSING');
          const isFinished = phaseUpper.includes('FINISH') || phaseUpper.includes('WINNER') || !!state.declaredWinner;

          // Cross Exam role check for active seat
          const questionerParticipant = state.participants?.find(p => p.id === state.crossExamQuestionerId);
          const respondentParticipant = state.participants?.find(p => p.id === state.crossExamRespondentId);

          const isMyQuestioner = questionerParticipant
            ? questionerParticipant.name.toLowerCase() === myTikTokName.toLowerCase()
            : false;

          const isMyRespondent = respondentParticipant
            ? respondentParticipant.name.toLowerCase() === myTikTokName.toLowerCase()
            : false;

          let badgeColor = 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20';
          let headline = 'Active Phase Guidance & Tips';

          if (isLobby) {
            badgeColor = 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20';
            headline = "Lobby & Debate Setup Phase";
          } else if (isOpening) {
            badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            headline = `You are Seat ${mySeatNumber} for Opening Statements`;
          } else if (isCrossExam) {
            badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            headline = "Cross-Examination Active";
          } else if (isRebuttal) {
            badgeColor = 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20';
            headline = myTeam === 'CONTRARY' ? 'Opposition Rebuttals Phase' : 'Affirmative Rebuttals Phase';
          } else if (isClosing) {
            badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            headline = "Closing Statements Phase";
          } else if (isFinished) {
            badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            headline = "Debate Concluded & Winner Declared";
          }

          return (
            <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded border ${badgeColor}`}>
                    {state.currentRound || 'Round 1'} · {state.currentPhase}
                  </span>
                  <h3 className="text-sm font-black text-white">{headline}</h3>
                </div>
                <span className="text-[10px] text-gray-500 font-mono font-bold uppercase hidden sm:inline">
                  Seat {mySeatNumber} Panel Guidance
                </span>
              </div>

              {isLobby && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-300 font-medium">
                    The debate is currently in the Lobby. Review the prompt above! You can begin drafting and filing claims or evidence below ahead of opening statements.
                  </p>
                </div>
              )}

              {isOpening && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-300 font-medium">
                    <strong className="text-blue-400">Seat {mySeatNumber} Instructions:</strong> Deliver your team's core position cleanly and establish key arguments:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>Be sure to make a claim:</strong> Frame your main thesis and core argument clearly.</span>
                    </li>
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Establish foundational principles early to anchor your team's position.</span>
                    </li>
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>Seats 2 & 3:</strong> You can "second" or "third" an existing claim below to add team support!</span>
                    </li>
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Avoid getting bogged down in defensive rebuttals too early.</span>
                    </li>
                  </ul>
                </div>
              )}

              {isCrossExam && (
                <div className="flex flex-col gap-2">
                  {isMyQuestioner && (
                    <div className="bg-purple-600/20 border-2 border-purple-500 rounded-xl p-3.5 text-xs text-purple-200 font-extrabold flex items-center gap-2.5 shadow-lg animate-pulse">
                      <Flame className="w-5 h-5 text-purple-400 shrink-0" />
                      <span>🎯 GET READY TO ASK YOUR QUESTION! Your seat has been selected to question the opposing team on stage right now!</span>
                    </div>
                  )}

                  {isMyRespondent && (
                    <div className="bg-orange-600/20 border-2 border-orange-500 rounded-xl p-3.5 text-xs text-orange-200 font-extrabold flex items-center gap-2.5 shadow-lg animate-pulse">
                      <Flame className="w-5 h-5 text-orange-400 shrink-0" />
                      <span>⚠️ YOU'RE ABOUT TO BE ASKED A QUESTION! Be ready to respond on stage with clear, evidence-backed arguments!</span>
                    </div>
                  )}

                  {!isMyQuestioner && !isMyRespondent && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300 font-bold flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Cross-Exam Rules: Each seat gets 1 question per opposing seat. Stay sharp and follow the stage dialogue!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                    <div className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>Ask sharp, direct questions targeting logic gaps in opposing claims.</span>
                    </div>
                    <div className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>When answering questions, stay calm, concise, and backed by evidence.</span>
                    </div>
                  </div>
                </div>
              )}

              {isRebuttal && (
                <div className="flex flex-col gap-2">
                  <div className="bg-[#f97316]/10 border border-[#f97316]/20 rounded-xl p-3 text-xs text-[#f97316] font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#f97316] shrink-0" />
                      <span>
                        {myTeam === 'CONTRARY' 
                          ? 'Opposition Rebuttals (Going First): Select Affirmative claims below to file counterclaims.' 
                          : 'Affirmative Rebuttals: Select Opposition claims below to file counterclaims.'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase bg-[#f97316]/20 px-2 py-0.5 rounded border border-[#f97316]/30 shrink-0 font-extrabold">
                      Seat Limit: {myRoundCCsCount}/2 Counterclaims Used for {state.currentRound || 'Round 1'}
                    </span>
                  </div>
                </div>
              )}

              {isClosing && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-300 font-medium">
                    This is your last chance to win points with the judge! Finish strong:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-300">
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Summarize your core winning points concisely.</span>
                    </li>
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Emphasize your strongest unrefuted evidence.</span>
                    </li>
                    <li className="bg-[#16171d] border border-[#2d2f39] p-2.5 rounded-xl flex items-start gap-2">
                      <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Make a clear final appeal to the judges for victory!</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          );
        })()}

        {/* TEAM CLAIMS & SECONDING SECTION (Available during Opening & Rebuttal) */}
        {myTeamClaims.length > 0 && (
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <ThumbsUp className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Our Team's Claims (Seat {mySeatNumber} Endorsement)
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-semibold">
                Second or third existing claims to add team support
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myTeamClaims.map((claim) => (
                <div key={claim.claimId} className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-3.5 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider">
                      Filed by {claim.speaker}
                    </span>
                    <p className="text-xs text-gray-200 font-semibold leading-relaxed italic">
                      "{claim.claimText}"
                    </p>
                  </div>

                  <button
                    onClick={() => handleSecondClaim(claim)}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Second / Support Claim</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience Chat Questions Preview — ONLY VISIBLE IN CHAT_QUESTIONS PHASE */}
        {((state.currentPhase || '').toUpperCase().includes('CHAT') || (state.currentPhase || '').toUpperCase().includes('QUESTION')) && (
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Audience Chat Questions</h3>
              </div>
              <span className="text-[10px] text-gray-400 font-semibold">
                {(state.chatQuestions || []).filter(q => q.status === 'approved' || q.status === 'pending').length} questions in queue
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Top audience questions submitted from live chat. Prepare your answers as the host presents them to the stage:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {(state.chatQuestions || [])
                .filter(q => q.status === 'approved' || q.status === 'pending')
                .slice(0, 6)
                .map((q) => (
                  <div key={q.id} className="bg-[#16171d] border border-[#2d2f39] rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-[#f97316]">{q.author}</span>
                      <span className="text-[9px] font-mono font-bold text-gray-400 bg-black/40 px-2 py-0.5 rounded">
                        👍 {q.votes || 0} votes
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 font-medium italic leading-snug">"{q.text}"</p>
                  </div>
                ))}

              {(state.chatQuestions || []).filter(q => q.status === 'approved' || q.status === 'pending').length === 0 && (
                <div className="col-span-2 py-6 text-center text-xs text-gray-500 font-semibold italic">
                  No audience chat questions in queue yet. New questions submitted by chat will appear here live!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Opposing Claims Inspector for Rebuttals */}
        {((state.currentPhase || '').toUpperCase().includes('REBUT')) && (
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {myTeam === 'CONTRARY' ? 'Opposing Affirmative Claims to Rebut' : 'Opposing Opposition Claims to Rebut'}
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-mono font-bold">
                Seat Limit: {myRoundCCsCount}/2 Used in {state.currentRound || 'Round 1'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opposingClaims.map((claim) => {
                const ccCount = (state.counterClaims || []).filter(cc => cc.claimId === claim.claimId).length;
                const isTargetedOnStage = state.rebuttalTargetClaimId === claim.claimId;
                const roundCCLimitReached = myRoundCCsCount >= 2;

                return (
                  <div 
                    key={claim.claimId} 
                    className={`bg-[#16171d] border rounded-xl p-4 flex flex-col justify-between gap-3 relative transition-all ${
                      isTargetedOnStage ? 'border-[#f97316] ring-1 ring-[#f97316]/50 bg-[#f97316]/5' : 'border-[#2d2f39]'
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#f97316]">
                          {claim.speaker} ({claim.team === 'PROPOSER' ? (state.settings?.proTeamName || 'Affirmative') : (state.settings?.conTeamName || 'Opposition')})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isTargetedOnStage && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-[#f97316] text-white px-2 py-0.5 rounded animate-pulse">
                              🎯 On Stage
                            </span>
                          )}
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                            roundCCLimitReached 
                              ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                              : 'bg-[#2d2f39] text-gray-300 border-[#3d404d]'
                          }`}>
                            {ccCount} Counterclaims
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-gray-100 leading-relaxed italic">
                        "{claim.claimText}"
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setTargetClaimId(claim.claimId);
                        const element = document.getElementById('counterclaim-section');
                        if (element) element.scrollIntoView({ behavior: 'smooth' });
                      }}
                      disabled={roundCCLimitReached}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        roundCCLimitReached
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : targetClaimId === claim.claimId
                          ? 'bg-[#f97316] text-white'
                          : 'bg-[#222530] hover:bg-[#2d3140] text-gray-200 border border-[#3d4254]'
                      }`}
                    >
                      {roundCCLimitReached ? (
                        <span>Round Limit Reached ({myRoundCCsCount}/2)</span>
                      ) : targetClaimId === claim.claimId ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected to Rebut</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#f97316]" />
                          <span>Rebut This Claim</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {opposingClaims.length === 0 && (
                <div className="col-span-2 py-8 text-center text-xs text-gray-500 font-bold italic bg-[#16171d]/50 border border-[#2d2f39] rounded-xl">
                  No opposing team claims approved on the board yet. Approved claims will appear here for direct rebuttals.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Forms Split Layout */}
        <div id="counterclaim-section" className={`grid grid-cols-1 ${(state.currentPhase === 'REBUTTAL' || state.currentPhase === 'REBUTTAL_OPPOSITION' || state.currentPhase === 'REBUTTAL_AFFIRMATIVE') ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-5 shrink-0`}>
          
          {/* COLUMN 1: SUBMIT A CLAIM */}
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[#1d1e24] pb-3">
              <div className="w-7 h-7 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#f97316]" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">File a Claim</h3>
            </div>

            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Submit a core assertion or debate point. Always available across all debate phases.
            </p>

            <form onSubmit={handleSubmitClaim} className="flex flex-col gap-3">
              <textarea
                required
                rows={3}
                placeholder="Enter your main claim or argument clearly..."
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white placeholder-gray-500 p-3.5 rounded-xl focus:outline-none focus:border-[#f97316] font-semibold leading-relaxed resize-none"
              />
              <button
                type="submit"
                disabled={!claimText.trim()}
                className="bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Claim to Host Desk</span>
              </button>
            </form>
          </div>

          {/* COLUMN 2: SUBMIT EVIDENCE */}
          <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[#1d1e24] pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Gavel className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Submit Evidence</h3>
            </div>

            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Flesh out an existing approved point. Link your evidence to an approved claim currently on the debate timeline.
            </p>

            <form onSubmit={handleSubmitEvidence} className="flex flex-col gap-3">
              {/* Dropdown to Link to Claim */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-400 uppercase">Link to Approved Claim</label>
                <select
                  required
                  value={linkedClaimId}
                  onChange={(e) => setLinkedClaimId(e.target.value)}
                  className="bg-[#16171d] border border-[#2d2f39] text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                >
                  <option value="">-- Choose a Claim to Back Up --</option>
                  {availableClaims.map((claim) => (
                    <option key={claim.claimId} value={claim.claimId}>
                      [{claim.speaker}] {claim.claimText.slice(0, 50)}...
                    </option>
                  ))}
                </select>
                {availableClaims.length === 0 && (
                  <span className="text-[10px] text-yellow-500/80 font-medium italic mt-0.5">
                    * No claims have been approved by the host yet to link evidence.
                  </span>
                )}
              </div>

              {/* Evidence Statement */}
              <div className="flex flex-col gap-1">
                <textarea
                  required
                  rows={2}
                  placeholder="Factual quote, statistic, or supporting evidence text..."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white placeholder-gray-500 p-3 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold leading-relaxed resize-none"
                />
              </div>

              {/* Source citation */}
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Source citation (e.g. Pew Research Center, 2026)"
                  value={evidenceSource}
                  onChange={(e) => setEvidenceSource(e.target.value)}
                  className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white placeholder-gray-500 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={!evidenceText.trim() || !linkedClaimId}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Submit Evidence to Host Desk</span>
              </button>
            </form>
          </div>

          {/* COLUMN 3: FILE A COUNTERCLAIM */}
          {(state.currentPhase === 'REBUTTAL' || state.currentPhase === 'REBUTTAL_OPPOSITION' || state.currentPhase === 'REBUTTAL_AFFIRMATIVE') && (
            <div className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-4 ring-1 ring-[#f97316]/30">
              <div className="flex items-center gap-2 border-b border-[#1d1e24] pb-3">
                <div className="w-7 h-7 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#f97316]" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">File a Counterclaim</h3>
              </div>

              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Directly rebut an approved claim from the opposing team. Limit: Maximum 2 counterclaims per claim.
              </p>

              <form onSubmit={handleSubmitCounterClaim} className="flex flex-col gap-3">
                {/* Select opposing claim to counter */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase">Opposing Claim to Rebut</label>
                  <select
                    required
                    value={targetClaimId}
                    onChange={(e) => setTargetClaimId(e.target.value)}
                    className="bg-[#16171d] border border-[#2d2f39] text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#f97316] font-semibold cursor-pointer"
                  >
                    <option value="">-- Choose Opponent's Claim --</option>
                    {opposingClaims.map((claim) => {
                      const existingCCCount = (state.counterClaims || []).filter(cc => cc.claimId === claim.claimId).length;
                      return (
                        <option 
                          key={claim.claimId} 
                          value={claim.claimId}
                          disabled={existingCCCount >= 2}
                        >
                          [{claim.speaker}] {claim.claimText.slice(0, 40)}... ({existingCCCount}/2 CCs)
                        </option>
                      );
                    })}
                  </select>
                  {opposingClaims.length === 0 && (
                    <span className="text-[10px] text-yellow-500/80 font-medium italic mt-0.5">
                      * No opposing team claims have been approved yet.
                    </span>
                  )}
                </div>

                {/* Counterclaim text */}
                <div className="flex flex-col gap-1">
                  <textarea
                    required
                    rows={2}
                    placeholder="Enter your counter argument here..."
                    value={counterText}
                    onChange={(e) => setCounterText(e.target.value)}
                    className="w-full bg-[#16171d] border border-[#2d2f39] text-xs text-white placeholder-gray-500 p-3 rounded-xl focus:outline-none focus:border-[#f97316] font-semibold leading-relaxed resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!counterText.trim() || !targetClaimId}
                  className="bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Counterclaim</span>
                </button>
              </form>
            </div>
          )}

        </div>

        {/* MY SUBMISSIONS FEED */}
        <section className="bg-[#101114] border border-[#1d1e24] rounded-2xl p-5 flex flex-col gap-3 flex-1 overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between border-b border-[#1d1e24] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white uppercase tracking-wider">My Debate Submissions</span>
              <span className="bg-[#16171d] border border-[#2d2f39] px-2 py-0.5 rounded text-[10px] font-mono font-bold text-gray-400">
                {myClaims.length + myEvidenceList.length + myCounterClaims.length} total
              </span>
            </div>
            <span className="text-[10px] text-gray-500 font-bold italic">Real-time status tracking</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
            {myClaims.length === 0 && myEvidenceList.length === 0 && myCounterClaims.length === 0 ? (
              <div className="h-full py-16 flex flex-col items-center justify-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-xs font-bold">📝</div>
                <p className="text-gray-400 text-xs font-bold">No submissions logged</p>
                <p className="text-gray-500 text-[10px] max-w-xs">Use the forms above to submit debate claims, corroborating evidence, or counterclaims to the Host Desk.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* MY CLAIMS SUB-SECTION */}
                {myClaims.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#f97316]" />
                      <span>My Claim Assertions ({myClaims.length})</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-2">
                      {myClaims.map((claim) => (
                        <div key={claim.claimId} className="bg-[#16171d]/60 border border-[#2d2f39] rounded-xl p-3.5 flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-1 min-w-0">
                            <p className="text-xs font-bold text-white leading-relaxed break-words">"{claim.claimText}"</p>
                            <span className="text-[9px] font-semibold text-gray-500">Submitted during {claim.phase}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${
                            claim.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : claim.status === 'declined'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
                          }`}>
                            {claim.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MY EVIDENCE SUB-SECTION */}
                {myEvidenceList.length > 0 && (
                  <div className="flex flex-col gap-2.5 mt-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Gavel className="w-3.5 h-3.5 text-emerald-400" />
                      <span>My Submitted Proof & Stats ({myEvidenceList.length})</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-2">
                      {myEvidenceList.map((ev) => {
                        const originalClaim = (state.formalClaims || []).find(c => c.claimId === ev.claimId);
                        return (
                          <div key={ev.evidenceId} className="bg-[#16171d]/60 border border-[#2d2f39] rounded-xl p-3.5 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <p className="text-xs font-bold text-white leading-relaxed">"{ev.evidenceText}"</p>
                                <span className="text-[10px] font-semibold text-gray-400">Source: {ev.source}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${
                                ev.status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
                                  : ev.status === 'declined' || ev.status === 'Invalid'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {ev.status}
                              </span>
                            </div>

                            {originalClaim && (
                              <div className="bg-[#0a0b0d] border border-[#2d2f39]/50 rounded-lg p-2 flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                                <Link2 className="w-3 h-3 text-[#f97316] shrink-0" />
                                <span className="truncate">Linked to claim: "{originalClaim.claimText}"</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MY COUNTERCLAIMS SUB-SECTION */}
                {myCounterClaims.length > 0 && (
                  <div className="flex flex-col gap-2.5 mt-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#f97316]" />
                      <span>My Counterclaims ({myCounterClaims.length})</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-2">
                      {myCounterClaims.map((cc) => {
                        const originalClaim = (state.formalClaims || []).find(c => c.claimId === cc.claimId);
                        return (
                          <div key={cc.id} className="bg-[#16171d]/60 border border-[#2d2f39] rounded-xl p-3.5 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <p className="text-xs font-bold text-white leading-relaxed">"{cc.counterText}"</p>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20">
                                Active
                              </span>
                            </div>

                            {originalClaim && (
                              <div className="bg-[#0a0b0d] border border-[#2d2f39]/50 rounded-lg p-2 flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                                <Link2 className="w-3 h-3 text-[#f97316] shrink-0" />
                                <span className="truncate">Countering claim: "{originalClaim.claimText}"</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Dynamic Winner Pop-Up Overlay Modal */}
      {(state.currentPhase === 'FINISHED' || state.currentPhase === 'WINNER' || state.declaredWinner) && showWinnerPopup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-[#101114] border border-[#2d2f39] rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col items-center text-center gap-5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#f97316] via-emerald-400 to-amber-400"></div>

            <button
              onClick={() => setShowWinnerPopup(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 animate-bounce mt-2">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Official Decision</span>
              <h2 className="text-2xl font-black text-white mt-1 uppercase tracking-wide">
                DEBATE WINNER DECLARED!
              </h2>
            </div>

            {(() => {
              const declared = state.declaredWinner;
              const calcWinner = state.scoringCalculations?.winningSide;
              const winnerSide = declared || (calcWinner !== 'NONE' && calcWinner !== 'TIE' ? calcWinner : null);
              const proName = state.settings?.proTeamName || 'Affirmative';
              const conName = state.settings?.conTeamName || 'Opposition';

              if (winnerSide === 'PROPOSER') {
                return (
                  <div className="w-full bg-[#f97316]/10 border border-[#f97316]/30 rounded-2xl p-5 flex flex-col items-center gap-2">
                    <span className="text-xs font-black text-[#f97316] uppercase tracking-wider">🏆 WINNING TEAM</span>
                    <h3 className="text-2xl font-black text-white">{proName}</h3>
                    <p className="text-xs text-gray-300 font-semibold mt-1">
                      Congratulations to the {proName} team on a compelling victory!
                    </p>
                  </div>
                );
              } else if (winnerSide === 'CONTRARY') {
                return (
                  <div className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex flex-col items-center gap-2">
                    <span className="text-xs font-black text-red-400 uppercase tracking-wider">🏆 WINNING TEAM</span>
                    <h3 className="text-2xl font-black text-white">{conName}</h3>
                    <p className="text-xs text-gray-300 font-semibold mt-1">
                      Congratulations to the {conName} team on a compelling victory!
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col items-center gap-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">🤝 RESULT</span>
                    <h3 className="text-xl font-black text-white">IT'S A DRAW / TIE DEBATE!</h3>
                    <p className="text-xs text-gray-300 font-semibold">
                      Outstanding performance from both teams!
                    </p>
                  </div>
                );
              }
            })()}

            <button
              onClick={() => setShowWinnerPopup(false)}
              className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold text-xs py-3.5 rounded-xl uppercase tracking-wider cursor-pointer transition-colors shadow-lg shadow-[#f97316]/20"
            >
              Close & View Panel
            </button>
          </div>
        </div>
      )}

      {/* Ground Rules Agreement Popup Modal */}
      {showGroundRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#101114] border-2 border-[#f97316]/40 w-full max-w-xl rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.8)] relative flex flex-col gap-4 max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#1d1e24] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#f97316]/10 border border-[#f97316]/30 rounded-xl text-[#f97316] shrink-0">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Debate Ground Rules</h3>
                    {agreedToRules && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Agreed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Official conduct guidelines and rules for seated panelists.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGroundRulesModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Topic Banner */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3 rounded-xl shrink-0">
              <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase block mb-0.5">Active Topic</span>
              <p className="text-xs font-bold text-white leading-relaxed">
                "{state.settings?.debateTopic || 'Should social media platforms be legally held liable for user-generated content?'}"
              </p>
            </div>

            {/* Scrollable Rules List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 max-h-[45vh] scrollbar-thin">
              {(state.rules || DEFAULT_DEBATE_RULES).filter(r => r.enabled !== false).map((rule, idx) => (
                <div key={rule.id || idx} className="bg-[#16171d] border border-[#2d2f39] p-3 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f97316]/20 text-[#f97316] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      {rule.name}
                    </span>
                    {rule.deductPoints ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                        -{rule.pointValue || 10} pts
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                        Eligibility Rule
                      </span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-[11px] text-gray-400 leading-relaxed pl-7">
                      {rule.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Mandatory Checkbox & Actions */}
            <div className="pt-3 border-t border-[#1d1e24] flex flex-col gap-3 shrink-0">
              <label className="flex items-start gap-3 p-3 bg-[#16171d] border border-[#2d2f39] hover:border-[#f97316]/50 rounded-xl cursor-pointer transition-all select-none">
                <input
                  type="checkbox"
                  checked={agreedCheckbox}
                  onChange={(e) => setAgreedCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 text-[#f97316] focus:ring-[#f97316] accent-[#f97316] cursor-pointer shrink-0"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white">
                    I agree to abide by all debate ground rules and conduct standards
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Check this box to confirm your compliance with the live debate rules while seated on stage.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGroundRulesModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#2d2f39] text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!agreedCheckbox}
                  onClick={() => {
                    setAgreedToRules(true);
                    if (myTikTokName) {
                      localStorage.setItem(`agreed_rules_${myTikTokName.toLowerCase()}`, 'true');
                    }
                    setShowGroundRulesModal(false);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
                    agreedCheckbox
                      ? 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-lg shadow-[#f97316]/20 cursor-pointer'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>I Agree & Abide</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
