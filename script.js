document.addEventListener('DOMContentLoaded', () => {
    const idkInput = document.getElementById('idkInput');
    const logButton = document.getElementById('logButton');
    const selectAllButton = document.getElementById('selectAllButton');
    const selectedCountDisplay = document.getElementById('selectedCount');
    const reviewedCountDisplay = document.getElementById('reviewedCountDisplay');
    const testKnowledgeButton = document.getElementById('testKnowledgeButton');
    const processSelectedButton = document.getElementById('processSelectedButton');
    const momentsList = document.getElementById('momentsList');
    const noMomentsPlaceholder = document.getElementById('noMomentsPlaceholder');
    const overallLoadingIndicator = document.getElementById('overallLoadingIndicator');
    const toastNotification = document.getElementById('toastNotification');
    const userPointsDisplay = document.getElementById('userPointsDisplay');

    const quizModalOverlay = document.getElementById('quizModalOverlay');
    const quizQuestionNumber = document.getElementById('quizQuestionNumber');
    const quizQuestionText = document.getElementById('quizQuestionText');
    const quizOptionsContainer = document.getElementById('quizOptionsContainer');
    const quizFeedbackArea = document.getElementById('quizFeedbackArea');
    const submitQuizAnswerButton = document.getElementById('submitQuizAnswerButton');
    const nextQuizQuestionButton = document.getElementById('nextQuizQuestionButton');
    const finishQuizButton = document.getElementById('finishQuizButton');
    const closeQuizButton = document.getElementById('closeQuizButton');

    // --- WARNING: API KEY EXPOSED IN CLIENT-SIDE CODE ---
    // --- FOR LOCAL TESTING ONLY. REVOKE KEY AFTER USE. ---
    const OPENAI_API_KEY = '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';
    // --- END WARNING ---

    // Use a distinct localStorage key for this version
    let loggedMoments = JSON.parse(localStorage.getItem('idk_moments_v14_mcq_quiz_direct_api')) || [];
    let userPoints = parseInt(localStorage.getItem('idk_user_points_v14_direct_api')) || 0;

    let currentQuizQuestionsData = [];
    let currentQuizQuestionIndex = 0;
    let currentQuizCorrectAnswersCount = 0;
    let selectedQuizOptionElement = null;

    function formatAnswerForRetroDisplay(text) {
        if (!text || typeof text !== 'string') return text;
        const prefix = '     > ';
        let processedHTML = text.split('\n')
                           .map(line => line.trim() === '' ? '' : prefix + line)
                           .join('<br>');
        processedHTML = processedHTML.replace(/^<br>\s*/, '').replace(/\s*<br>$/, '');
        processedHTML = processedHTML.replace(/(<br>\s*){2,}/g, '<br>');
        return processedHTML;
    }

    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 2500);
    }

    function autoSetInitialType(text) {
        const lowerText = text.toLowerCase().trim();
        if (lowerText.endsWith('?')) return 'question';
        const questionStarters = ['what', 'when', 'where', 'who', 'why', 'how', 'is ', 'are ', 'do ', 'does ', 'did ', 'can ', 'could ', 'will ', 'would ', 'should ', 'may ', 'might '];
        for (const starter of questionStarters) { if (lowerText.startsWith(starter)) return 'question'; }
        return 'statement';
    }

    function updateCountersAndPointsDisplay() {
        const reviewedCount = loggedMoments.filter(m => m.userMarkedReviewed).length;
        const reviewedWithAnswersCount = loggedMoments.filter(m => m.userMarkedReviewed && m.answer).length;
        reviewedCountDisplay.textContent = `(${reviewedCount}/${loggedMoments.length} Reviewed)`;
        testKnowledgeButton.disabled = reviewedWithAnswersCount < 1;

        const selectedCount = loggedMoments.filter(m => m.selectedForBatch).length;
        selectedCountDisplay.textContent = `${selectedCount} SEL`;
        processSelectedButton.disabled = selectedCount === 0;
        
        if (loggedMoments.length > 0) { 
            selectAllButton.textContent = (selectedCount === loggedMoments.length && selectedCount > 0) ? "DESEL. ALL" : "SEL. ALL";
        } else {
            selectAllButton.textContent = "SEL. ALL";
        }
        userPointsDisplay.textContent = userPoints;
    }
    
    function renderMoments() {
         momentsList.innerHTML = ''; 
         const anyMoments = loggedMoments.length > 0;
         noMomentsPlaceholder.style.display = anyMoments ? 'none' : 'block';
         processSelectedButton.style.display = anyMoments ? 'block' : 'none';
         document.querySelector('.list-controls-bar').style.display = anyMoments ? 'flex' : 'none';

         loggedMoments.forEach((moment) => {
            const listItem = document.createElement('li'); 
            listItem.className = `moment-card type-${moment.type}`; 
            listItem.id = `moment-item-${moment.timestamp}`;
            if (moment.newlyAdded) { listItem.classList.add('newly-added'); setTimeout(() => { const el = document.getElementById(`moment-item-${moment.timestamp}`); if (el) el.classList.remove('newly-added'); moment.newlyAdded = false; }, 2000); }
            if (moment.type === 'statement' && moment.aiVerdict) { listItem.classList.add(`verdict-${moment.aiVerdict}`);}
            if (moment.userMarkedReviewed) { listItem.classList.add('user-reviewed');}
            let sT = '', sC = 'status-pending';
            if (moment.type === 'question') { sT = 'QSTN'; sC = 'status-question'; }
            else if (moment.type === 'statement') { if (moment.aiVerdict === 'correct') { sT = 'OK'; sC = 'status-correct'; } else if (moment.aiVerdict === 'incorrect') { sT = 'X'; sC = 'status-incorrect'; } else if (moment.aiVerdict === 'unclear') { sT = '???'; sC = 'status-unclear'; } else { sT = 'STMT'; }}
            const pSHTML = '<span class="spinner-char"></span> PROCESSING...'; 
            const dAT = (moment.type === 'statement' && !moment.aiVerdict) ? 'NEEDS VALIDATION.' : 'NO AI INSIGHT YET.'; 
            const dAnswerHTML = moment.answer ? formatAnswerForRetroDisplay(moment.answer) : dAT; 
            const aCHTML = moment.isProcessing || moment.isRegenerating ? pSHTML : dAnswerHTML;
            listItem.innerHTML = `<div class="moment-header"><div class="moment-checkbox-container"><input type="checkbox" data-timestamp="${moment.timestamp}" ${moment.selectedForBatch ? 'checked' : ''}></div><div class="moment-text-container" data-timestamp="${moment.timestamp}"><div class="moment-main-text"><span class="moment-text">${moment.text}</span><span class="moment-timestamp">${new Date(moment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <span class="status-indicator ${sC}">${sT}</span></span></div><i class="fas fa-caret-down expand-icon ${moment.isAnswerExpanded ? 'expanded' : ''}"></i></div><div class="moment-actions"><button class="action-button review-button ${moment.userMarkedReviewed ? 'reviewed-true' : ''}" data-timestamp="${moment.timestamp}" title="${moment.userMarkedReviewed ? 'UNREVIEW' : 'REVIEW'}"><i class="fas ${moment.userMarkedReviewed ? 'fa-check' : 'fa-question'}"></i></button></div></div><div class="moment-answer-wrapper ${moment.isAnswerExpanded ? 'expanded' : ''}"><div class="moment-answer-content" id="answer-content-${moment.timestamp}">${aCHTML}</div>${moment.answer && !moment.isProcessing && !moment.isRegenerating ? `<div class="regenerate-answer-button-container"><button class="regenerate-answer-button" data-timestamp="${moment.timestamp}" ${moment.hasBeenRegenerated ? 'disabled' : ''}><i class="fas fa-redo"></i> ${moment.hasBeenRegenerated ? "REGEN'D" : 'REGEN (1)'}</button></div>` : ''}</div>`;
            momentsList.appendChild(listItem);
            if (moment.isProcessing || moment.isRegenerating) { 
                const acd = listItem.querySelector(`#answer-content-${moment.timestamp}`); 
                if(acd) { 
                    const scs = acd.querySelector('.spinner-char'); 
                    if(scs && !moment.spinnerInterval) { 
                        let sCh = ["|", "/", "-", "\\"]; 
                        let cI = 0; 
                        moment.spinnerInterval = setInterval(() => { scs.textContent = sCh[cI++ % sCh.length]; }, 150);
                    }
                }
            } else if (moment.spinnerInterval) { 
                clearInterval(moment.spinnerInterval); 
                moment.spinnerInterval = null; 
            }
         });
         document.querySelectorAll('.moment-checkbox-container input[type="checkbox"]').forEach(cb => cb.addEventListener('change', handleCheckboxChange)); 
         document.querySelectorAll('.moment-text-container').forEach(tc => tc.addEventListener('click', handleTextContainerClick)); 
         document.querySelectorAll('.review-button').forEach(btn => btn.addEventListener('click', handleReviewButtonClick)); 
         document.querySelectorAll('.regenerate-answer-button').forEach(btn => btn.addEventListener('click', handleRegenerateButtonClick));
         updateCountersAndPointsDisplay();
    }
    function handleCheckboxChange(event) { const ts = parseInt(event.target.dataset.timestamp); const mom = loggedMoments.find(m => m.timestamp === ts); if (mom) mom.selectedForBatch = event.target.checked; saveMoments(); updateCountersAndPointsDisplay(); }
    function handleTextContainerClick(event) { const ts = parseInt(event.currentTarget.dataset.timestamp); const mom = loggedMoments.find(m => m.timestamp === ts); if (mom && !mom.answer && !mom.isProcessing && !mom.isRegenerating) { const liEl = document.getElementById(`moment-item-${ts}`); fetchSingleAIAnswer(mom, liEl, true);} else { toggleAnswerExpansion(ts);}}
    function handleReviewButtonClick(event) { const ts = parseInt(event.currentTarget.dataset.timestamp); toggleUserReviewedStatus(ts); }
    function handleRegenerateButtonClick(event) { const ts = parseInt(event.currentTarget.dataset.timestamp); const mom = loggedMoments.find(m => m.timestamp === ts); const liEl = document.getElementById(`moment-item-${ts}`); if (mom && liEl && !mom.hasBeenRegenerated) { regenerateAIAnswer(mom, liEl); } }
    function toggleAnswerExpansion(timestamp) { const m = loggedMoments.find(mo => mo.timestamp === timestamp); if (m) {m.isAnswerExpanded = !m.isAnswerExpanded; saveMoments(); renderMoments();}}
    
    function saveMoments() { 
        localStorage.setItem('idk_moments_v14_mcq_quiz_direct_api', JSON.stringify(loggedMoments)); 
        localStorage.setItem('idk_user_points_v14_direct_api', userPoints.toString());
    }
    function toggleUserReviewedStatus(timestamp) { const m = loggedMoments.find(mo => mo.timestamp === timestamp); if (m) { m.userMarkedReviewed = !m.userMarkedReviewed; showToast(m.userMarkedReviewed ? "REVIEWED!" : "UNREVIEWED."); saveMoments(); renderMoments(); } }
    
    logButton.addEventListener('click', () => { 
        const t = idkInput.value.trim(); 
        if (t) { 
            const iT = autoSetInitialType(t); 
            loggedMoments.unshift({text: t, timestamp: Date.now(), type: iT, aiVerdict: null, userMarkedReviewed: false, answer: null, isAnswerExpanded: false, hasBeenRegenerated: false, selectedForBatch: false, isProcessing: false, isRegenerating: false, newlyAdded: true, spinnerInterval: null}); 
            idkInput.value = ''; 
            showToast("MOMENT LOGGED!"); 
            saveMoments(); 
            renderMoments();
        } else { 
            showToast("INPUT TEXT REQUIRED.");
        }
    });
    
    selectAllButton.addEventListener('click', () => { 
        const allSelected = loggedMoments.length > 0 && loggedMoments.every(m => m.selectedForBatch);
        const targetState = !allSelected;
        loggedMoments.forEach(m => m.selectedForBatch = targetState);
        saveMoments();
        renderMoments();
    });
    
    const AI_MCQ_PROMPT_SYSTEM = `You are a quiz question generator. Based on the user's original logged text and an AI explanation, create a single, concise question to test comprehension of this information. Then provide ONE correct answer and TWO plausible but incorrect distractor answers.
Format your entire response *strictly* as:
Q: [Your Question Here]
C: [The Correct Answer Here]
D1: [Distractor 1 Here]
D2: [Distractor 2 Here]
Do not add any other text or conversational pleasantries.`;
    const AI_STATEMENT_SYSTEM_PROMPT = `You are a factual validation assistant. Your task is to assess a user's statement... Output in plain text suitable for a retro computer interface.`; // Full prompt as defined before
    const AI_REGENERATE_SYSTEM_PROMPT = `You are a helpful assistant... Output in plain text suitable for a retro computer interface.`; // Full prompt as defined before

    async function fetchAIAnswerLogic(moment, isRegeneration = false, isQuizQuestionGen = false, quizMomentContext = null) {
        if (!OPENAI_API_KEY) { // Check if key is present (it is, in this version)
           console.error('OpenAI API Key is missing! Cannot make API calls.');
           throw new Error('OpenAI API Key is missing!');
        }

        let systemPrompt = "You are a helpful assistant. Be clear, concise, and friendly. Output in plain text suitable for a retro computer interface.";
        let userQuery = "";
        let modelToUse = 'gpt-3.5-turbo';

        if (isQuizQuestionGen && quizMomentContext) {
            systemPrompt = AI_MCQ_PROMPT_SYSTEM;
            userQuery = `User's original log: "${quizMomentContext.text}"\nAI's explanation of that log: "${quizMomentContext.answer || '(No previous answer provided for this log)'}"\n\nGenerate an MCQ based on this.`;
        } else if (isRegeneration) {
            systemPrompt = AI_REGENERATE_SYSTEM_PROMPT;
            userQuery = `Original query/statement: "${moment.text}"`;
        } else if (moment.type === 'question') {
            userQuery = `Explain this to me simply, like for a retro computer interface: "${moment.text}"`;
        } else if (moment.type === 'statement') {
            systemPrompt = AI_STATEMENT_SYSTEM_PROMPT;
            userQuery = `Statement to validate: "${moment.text}"`;
        }

        const requestBodyToOpenAI = {
            model: modelToUse,
            messages: [{ "role": "system", "content": systemPrompt }, { "role": "user", "content": userQuery }],
            max_tokens: isQuizQuestionGen ? 150 : 200,
            temperature: isQuizQuestionGen ? 0.7 : (isRegeneration ? 0.6 : 0.4)
        };
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}` // Using the key directly
            }, 
            body: JSON.stringify(requestBodyToOpenAI)
        });

        if (!response.ok) { 
            const eD = await response.json().catch(() => ({error: {message: "Unknown API error"}})); 
            console.error("OpenAI API Error:", eD);
            throw new Error(`API Error (${response.status}): ${eD.error?.message || 'Unknown'}`);
        }
        const data = await response.json(); 
        let rawAnswerText = data.choices[0]?.message?.content.trim() || "NO RESPONSE.";
        
        if (!isQuizQuestionGen && moment && moment.type === 'statement' && !isRegeneration) {
            if (rawAnswerText.startsWith('[CORRECT]')) { moment.aiVerdict = 'correct'; rawAnswerText = rawAnswerText.substring(9).trim(); } 
            else if (rawAnswerText.startsWith('[INCORRECT]')) { moment.aiVerdict = 'incorrect'; rawAnswerText = rawAnswerText.substring(11).trim(); } 
            else if (rawAnswerText.startsWith('[UNCLEAR]')) { moment.aiVerdict = 'unclear'; rawAnswerText = rawAnswerText.substring(9).trim(); } 
        }
        return rawAnswerText;
    }

    async function fetchSingleAIAnswer(moment, listItemElement, expandAfterFetch = false) { 
        if (moment.isProcessing || moment.isRegenerating) return; 
        moment.isProcessing = true; 
        if (expandAfterFetch) moment.isAnswerExpanded = false; 
        renderMoments(); 
        try { 
            const aT = await fetchAIAnswerLogic(moment); 
            moment.answer = aT; 
            if (expandAfterFetch) moment.isAnswerExpanded = true; 
        } catch (e) { 
            console.error('Error fetching single AI answer:', e);
            moment.answer = `ERROR: ${e.message}`; 
            if (expandAfterFetch) moment.isAnswerExpanded = true;  
        } finally { 
            moment.isProcessing = false; 
            saveMoments(); 
            renderMoments(); 
        }
    }
    async function regenerateAIAnswer(moment, listItemElement) { 
        if (moment.hasBeenRegenerated || moment.isProcessing || moment.isRegenerating) return; 
        moment.isRegenerating = true; 
        moment.isAnswerExpanded = true; 
        renderMoments(); 
        try { 
            const aT = await fetchAIAnswerLogic(moment, true); 
            moment.answer = aT; 
            moment.hasBeenRegenerated = true; 
            showToast("RESPONSE REGENERATED!"); 
        } catch (e) { 
            console.error('Error regenerating AI answer:', e);
            moment.answer = `REGEN ERROR: ${e.message}`; 
        } finally { 
            moment.isRegenerating = false; 
            saveMoments(); 
            renderMoments(); 
        }
    }
    processSelectedButton.addEventListener('click', async () => { 
        const iTP = loggedMoments.filter(m => m.selectedForBatch && !m.isProcessing && !m.isRegenerating); 
        if (iTP.length === 0) { showToast("NO ITEMS SELECTED."); return; } 
        processSelectedButton.disabled = true; 
        overallLoadingIndicator.textContent = `PROCESSING 0/${iTP.length}...`; 
        overallLoadingIndicator.style.display = 'block'; 
        let pC = 0; 
        for (const m of iTP) { 
            m.isProcessing = true; 
            renderMoments(); 
            try { 
                const aT = await fetchAIAnswerLogic(m); 
                m.answer = aT; 
                m.isAnswerExpanded = true; 
            } catch (e) { 
                console.error(`Error processing moment "${m.text}":`, e);
                m.answer = `ERROR: ${e.message}`; 
                m.isAnswerExpanded = true; 
            } finally { 
                m.isProcessing = false; 
                m.selectedForBatch = false; 
                pC++; 
                overallLoadingIndicator.textContent = `PROCESSING ${pC}/${iTP.length}...`; 
                saveMoments(); 
                renderMoments(); 
            }
        } 
        overallLoadingIndicator.textContent = `BATCH COMPLETE! ${pC} ITEMS.`; 
        showToast(`BATCH OK: ${pC} PROCESSED!`); 
        setTimeout(() => { overallLoadingIndicator.style.display = 'none'; }, 3000); 
        processSelectedButton.disabled = false; 
    });

    // --- MCQ QUIZ LOGIC (as before, with direct API calls) ---
    testKnowledgeButton.addEventListener('click', async () => {
        const reviewedItemsWithAnswers = loggedMoments.filter(m => m.userMarkedReviewed && m.answer);
        if (reviewedItemsWithAnswers.length === 0) { showToast("NO REVIEWED ITEMS WITH ANSWERS TO TEST!"); return; }

        currentQuizQuestionsData = [];
        testKnowledgeButton.disabled = true; testKnowledgeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PREP QUIZ...';
        const shuffled = reviewedItemsWithAnswers.sort(() => 0.5 - Math.random());
        const itemsForQuiz = shuffled.slice(0, 3);

        for (const item of itemsForQuiz) {
            try {
                const mcqText = await fetchAIAnswerLogic(null, false, true, item);
                const qMatch = mcqText.match(/Q:\s*([\s\S]*?)\nC:/i);
                const cMatch = mcqText.match(/C:\s*([\s\S]*?)\nD1:/i);
                const d1Match = mcqText.match(/D1:\s*([\s\S]*?)\nD2:/i);
                const d2Match = mcqText.match(/D2:\s*([\s\S]*?)$/i);

                if (qMatch && qMatch[1] && cMatch && cMatch[1] && d1Match && d1Match[1] && d2Match && d2Match[1]) {
                    const question = qMatch[1].trim();
                    const correctAnswer = cMatch[1].trim();
                    const distractor1 = d1Match[1].trim();
                    const distractor2 = d2Match[1].trim();
                    let options = [correctAnswer, distractor1, distractor2];
                    options.sort(() => 0.5 - Math.random());
                    currentQuizQuestionsData.push({ question, options, correctAnswerText: correctAnswer });
                } else { console.warn("MCQ PARSE FAIL:", mcqText, "for item:", item.text); }
            } catch (e) { console.error("Error gen quiz MCQ:", e); }
        }
        testKnowledgeButton.disabled = false; testKnowledgeButton.innerHTML = 'Test Knowledge!';
        if (currentQuizQuestionsData.length > 0) {
            currentQuizQuestionIndex = 0; currentQuizCorrectAnswersCount = 0;
            displayMCQQuestion();
            quizModalOverlay.classList.add('show');
            closeQuizButton.style.display = 'none'; finishQuizButton.style.display = 'none';
        } else { showToast("COULDN'T PREPARE QUIZ. TRY AGAIN."); }
    });

    function displayMCQQuestion() { /* As before */ if (currentQuizQuestionIndex < currentQuizQuestionsData.length) { const qD = currentQuizQuestionsData[currentQuizQuestionIndex]; quizQuestionNumber.textContent = `QUESTION ${currentQuizQuestionIndex + 1} OF ${currentQuizQuestionsData.length}`; quizQuestionText.textContent = qD.question; quizOptionsContainer.innerHTML = ''; qD.options.forEach(oT => { const oD = document.createElement('div'); oD.classList.add('quiz-option'); oD.textContent = oT; oD.addEventListener('click', () => selectQuizOption(oD, oT)); quizOptionsContainer.appendChild(oD); }); quizFeedbackArea.textContent = 'CHOOSE AN OPTION.'; quizFeedbackArea.className = 'quiz-feedback-area'; submitQuizAnswerButton.style.display = 'inline-block'; submitQuizAnswerButton.disabled = true; nextQuizQuestionButton.style.display = 'none'; finishQuizButton.style.display = 'none'; selectedQuizOptionElement = null; } else { finishMCQQuiz(); }}
    function selectQuizOption(optionDiv, optionText) { /* As before */ if (submitQuizAnswerButton.style.display === 'none') return; if (selectedQuizOptionElement) { selectedQuizOptionElement.classList.remove('selected'); } optionDiv.classList.add('selected'); selectedQuizOptionElement = optionDiv; submitQuizAnswerButton.disabled = false; }
    submitQuizAnswerButton.addEventListener('click', () => { /* As before */ if (!selectedQuizOptionElement) return; const uAT = selectedQuizOptionElement.textContent; const qD = currentQuizQuestionsData[currentQuizQuestionIndex]; const iC = uAT === qD.correctAnswerText; if (iC) { quizFeedbackArea.textContent = "CORRECT!"; quizFeedbackArea.className = 'quiz-feedback-area correct'; selectedQuizOptionElement.classList.add('correct'); currentQuizCorrectAnswersCount++; } else { quizFeedbackArea.textContent = `INCORRECT. Correct was: ${qD.correctAnswerText}`; quizFeedbackArea.className = 'quiz-feedback-area incorrect'; selectedQuizOptionElement.classList.add('incorrect'); quizOptionsContainer.querySelectorAll('.quiz-option').forEach(opt => { if (opt.textContent === qD.correctAnswerText) { opt.classList.add('correct'); }}); } quizOptionsContainer.querySelectorAll('.quiz-option').forEach(opt => { opt.style.pointerEvents = 'none'; }); submitQuizAnswerButton.style.display = 'none'; if (currentQuizQuestionIndex < currentQuizQuestionsData.length - 1) { nextQuizQuestionButton.style.display = 'inline-block'; } else { finishQuizButton.style.display = 'inline-block'; }});
    nextQuizQuestionButton.addEventListener('click', () => { currentQuizQuestionIndex++; displayMCQQuestion(); });
    finishQuizButton.addEventListener('click', finishMCQQuiz);
    closeQuizButton.addEventListener('click', () => { quizModalOverlay.classList.remove('show'); });
    function finishMCQQuiz() { /* As before */ let qRT = `QUIZ COMPLETE! YOU GOT ${currentQuizCorrectAnswersCount} OF ${currentQuizQuestionsData.length} CORRECT.`; if (currentQuizCorrectAnswersCount === currentQuizQuestionsData.length && currentQuizQuestionsData.length > 0) { userPoints += 5; saveMoments(); renderMoments(); qRT += `\nPERFECT SCORE! +5 <i class="fas fa-coins points-icon"></i> POINTS! TOTAL: ${userPoints}`; showToast(`PERFECT QUIZ! +5 PTS!`); } else { showToast(`QUIZ DONE. ${currentQuizCorrectAnswersCount}/${currentQuizQuestionsData.length}.`); } quizFeedbackArea.innerHTML = qRT.replace(/\n/g, '<br>'); submitQuizAnswerButton.style.display = 'none'; nextQuizQuestionButton.style.display = 'none'; finishQuizButton.style.display = 'none'; closeQuizButton.style.display = 'inline-block'; }
    
    renderMoments(); // Initial render
});
