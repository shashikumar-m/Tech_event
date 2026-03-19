const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Mock Judge0 wrapper for code execution (to simplify local testing without API Key limits)
// In a real scenario, this would format payload and POST to https://judge0-ce.p.rapidapi.com/submissions
const executeCodeMock = async (sourceCode, languageId, expectedOutput, standardInput) => {
    // This is a naive stub for demonstration
    // If output matches expected strictly, it passes
    // Normally you send source_code, language_id, stdin, expected_output setup to Judge0
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    await delay(500); // Simulate network latency

    let status = { id: 3, description: "Accepted" };
    let stdout = "mock output"; // In real usage this comes from Judge0

    // Extremely naive evaluation mock: if sourceCode contains expectedOutput string, pass.
    if (sourceCode.includes("console.log") && expectedOutput) {
        stdout = expectedOutput.trim();
    } else {
        status = { id: 4, description: "Wrong Answer" };
    }
    
    return {
        stdout,
        status,
    };
};

// @desc    Run code against visible test cases
// @route   POST /api/code/run
router.post('/run', async (req, res) => {
    try {
        const { code, questionId } = req.body;
        
        const question = await Question.findById(questionId);
        if(!question || question.type !== 'coding') return res.status(404).json({message: 'Invalid coding question'});

        const visibleTestCases = question.testCases.filter(tc => !tc.isHidden);
        
        let results = [];
        for (let tc of visibleTestCases) {
             const execResult = await executeCodeMock(code, 63, tc.expectedOutput, tc.input); // 63 is Node.js Judge0 ID
             results.push({
                 input: tc.input,
                 expectedOutput: tc.expectedOutput,
                 actualOutput: execResult.stdout,
                 passed: execResult.status.id === 3
             });
        }

        res.json({ results });

    } catch (error) {
         res.status(500).json({ message: error.message });
    }
});

// @desc    Submit code (evaluated against all test cases, hidden + visible)
// @route   POST /api/code/submit
router.post('/submit', async (req, res) => {
    try {
         const { code, questionId, timeTaken } = req.body;

         const question = await Question.findById(questionId);
         if(!question || question.type !== 'coding') return res.status(404).json({message: 'Invalid coding question'});

         let allPassed = true;
         for (let tc of question.testCases) {
             const execResult = await executeCodeMock(code, 63, tc.expectedOutput, tc.input);
             if (execResult.status.id !== 3) {
                 allPassed = false;
                 break;
             }
         }

         // Save Submission
         const submission = await Submission.findOneAndUpdate(
             { userId: req.user._id, questionId },
             { 
                 eventId: req.user.eventId, 
                 type: 'coding', 
                 code, 
                 isCorrect: allPassed,
                 timeTaken 
             },
             { upsert: true, new: true }
         );

         res.json({ message: 'Code Submitted', passed: allPassed });
         
    } catch(error) {
         res.status(500).json({ message: error.message });
    }
});

module.exports = router;
