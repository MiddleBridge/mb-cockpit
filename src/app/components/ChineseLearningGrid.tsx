"use client";

import { useState, useEffect } from "react";
import { HSK4Word, hsk4Vocabulary, getRandomWords } from "@/lib/hsk4-vocabulary";

interface WordSquare {
  id: number;
  word: HSK4Word;
  correctAnswers: number; // Liczba poprawnych odpowiedzi (0-5)
}

const GRID_SIZE = 20; // 20x20 = 400 squares
const TOTAL_SQUARES = GRID_SIZE * GRID_SIZE;
const REQUIRED_CORRECT_ANSWERS = 5; // Wymagana liczba poprawnych odpowiedzi, żeby znać słowo

export default function ChineseLearningGrid() {
  const [squares, setSquares] = useState<WordSquare[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<HSK4Word | null>(null);
  const [questionType, setQuestionType] = useState<"meaning" | "pinyin" | "sentence">("meaning");
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [currentSquareId, setCurrentSquareId] = useState<number | null>(null);

  // Initialize squares
  useEffect(() => {
    const savedProgress = localStorage.getItem("chinese_learning_progress");
    let progressMap: Record<number, number> = {}; // {squareId: correctAnswers}
    
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        // Obsługa starego formatu (tablica ID) i nowego formatu (mapa)
        if (Array.isArray(parsed)) {
          // Stary format - konwersja do nowego
          parsed.forEach((id: number) => {
            progressMap[id] = REQUIRED_CORRECT_ANSWERS;
          });
        } else {
          progressMap = parsed;
        }
      } catch (e) {
        console.error("Error loading progress:", e);
      }
    }

    // Create 400 squares, repeating words as needed
    const newSquares: WordSquare[] = [];
    for (let i = 0; i < TOTAL_SQUARES; i++) {
      const wordIndex = i % hsk4Vocabulary.length;
      const word = hsk4Vocabulary[wordIndex];
      newSquares.push({
        id: i + 1,
        word: word,
        correctAnswers: progressMap[i + 1] || 0
      });
    }
    
    setSquares(newSquares);
    loadNewQuestion(newSquares);
  }, []);

  const loadNewQuestion = (currentSquares?: WordSquare[]) => {
    const squaresToUse = currentSquares || squares;
    // Find unlearned squares (those with less than REQUIRED_CORRECT_ANSWERS)
    const unlearnedSquares = squaresToUse.filter(sq => sq.correctAnswers < REQUIRED_CORRECT_ANSWERS);
    
    if (unlearnedSquares.length === 0) {
      setCurrentQuestion(null);
      return;
    }

    // Pick random unlearned square
    const randomSquare = unlearnedSquares[Math.floor(Math.random() * unlearnedSquares.length)];
    const word = randomSquare.word;
    
    setCurrentQuestion(word);
    setCurrentSquareId(randomSquare.id);
    setUserAnswer("");
    setSelectedOption(null);
    setShowAnswer(false);
    setIsCorrect(null);

    // Random question type
    const types: ("meaning" | "pinyin" | "sentence")[] = ["meaning", "pinyin", "sentence"];
    const randomType = types[Math.floor(Math.random() * types.length)];
    setQuestionType(randomType);

    // Generate multiple choice options
    if (randomType === "meaning") {
      const options = getRandomWords(3, word.id).map(w => w.meaning);
      options.push(word.meaning);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    } else if (randomType === "pinyin") {
      const options = getRandomWords(3, word.id).map(w => w.pinyin);
      options.push(word.pinyin);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    } else if (randomType === "sentence") {
      const options = getRandomWords(3, word.id).map(w => w.exampleSentence);
      options.push(word.exampleSentence);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    }
  };

  const checkAnswer = () => {
    if (!currentQuestion || currentSquareId === null) return;

    let correct = false;
    if (questionType === "meaning") {
      correct = userAnswer.toLowerCase().trim() === currentQuestion.meaning.toLowerCase().trim() ||
                selectedOption === currentQuestion.meaning;
    } else if (questionType === "pinyin") {
      correct = userAnswer.toLowerCase().trim() === currentQuestion.pinyin.toLowerCase().trim() ||
                selectedOption === currentQuestion.pinyin;
    } else if (questionType === "sentence") {
      correct = selectedOption === currentQuestion.exampleSentence;
    }

    setIsCorrect(correct);
    setShowAnswer(true);

    if (correct && currentSquareId !== null) {
      // Increment correct answers count
      setSquares(prev => {
        const updated = prev.map(sq => 
          sq.id === currentSquareId 
            ? { ...sq, correctAnswers: Math.min(sq.correctAnswers + 1, REQUIRED_CORRECT_ANSWERS) }
            : sq
        );
        
        // Save progress as map {squareId: correctAnswers}
        const progressMap: Record<number, number> = {};
        updated.forEach(sq => {
          if (sq.correctAnswers > 0) {
            progressMap[sq.id] = sq.correctAnswers;
          }
        });
        localStorage.setItem("chinese_learning_progress", JSON.stringify(progressMap));
        
        return updated;
      });
    }
  };

  const handleNext = () => {
    loadNewQuestion();
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (questionType === "sentence") {
      // Auto-check for sentence mode
      setTimeout(() => {
        const correct = option === currentQuestion?.exampleSentence;
        setIsCorrect(correct);
        setShowAnswer(true);
        
        if (correct && currentSquareId !== null) {
          setSquares(prev => {
            const updated = prev.map(sq => 
              sq.id === currentSquareId 
                ? { ...sq, correctAnswers: Math.min(sq.correctAnswers + 1, REQUIRED_CORRECT_ANSWERS) }
                : sq
            );
            
            const progressMap: Record<number, number> = {};
            updated.forEach(sq => {
              if (sq.correctAnswers > 0) {
                progressMap[sq.id] = sq.correctAnswers;
              }
            });
            localStorage.setItem("chinese_learning_progress", JSON.stringify(progressMap));
            
            return updated;
          });
        }
      }, 300);
    }
  };

  const learnedCount = squares.filter(sq => sq.correctAnswers >= REQUIRED_CORRECT_ANSWERS).length;
  const progress = squares.length > 0 ? (learnedCount / squares.length) * 100 : 0;

  const getSquareClassName = (correctAnswers: number) => {
    if (correctAnswers >= REQUIRED_CORRECT_ANSWERS) {
      return "bg-green-600 text-white hover:bg-green-700";
    } else if (correctAnswers === 4) {
      return "bg-green-500 text-white hover:bg-green-600";
    } else if (correctAnswers === 3) {
      return "bg-green-400 text-white hover:bg-green-500";
    } else if (correctAnswers === 2) {
      return "bg-green-300 text-neutral-900 hover:bg-green-400";
    } else if (correctAnswers === 1) {
      return "bg-green-200 text-neutral-900 hover:bg-green-300";
    } else {
      return "bg-neutral-800 text-neutral-400 hover:bg-neutral-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Nauka chińskiego - HSK4</h1>
        <div className="text-lg text-neutral-300">
          Postęp: <span className="font-bold text-green-400">{learnedCount}</span> / {TOTAL_SQUARES} ({Math.round(progress)}%)
        </div>
      </div>

      {/* Question section */}
      {currentQuestion && (
        <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
          <div className="text-center mb-6">
            {questionType === "sentence" && !showAnswer ? (
              <div className="text-5xl font-bold text-neutral-500 mb-3">???</div>
            ) : (
              <>
                <div className="text-5xl font-bold text-white mb-3">{currentQuestion.chinese}</div>
                {showAnswer && (
                  <div className="text-xl text-neutral-400">{currentQuestion.pinyin}</div>
                )}
              </>
            )}
            {currentSquareId !== null && (
              <div className="text-sm text-neutral-500 mt-2">
                Postęp: {squares.find(sq => sq.id === currentSquareId)?.correctAnswers || 0} / {REQUIRED_CORRECT_ANSWERS}
              </div>
            )}
          </div>

          {/* Question based on type */}
          {questionType === "meaning" && (
            <div className="space-y-4">
              <div className="text-lg text-neutral-300 mb-4">Jakie jest znaczenie tego słowa?</div>
              
              <div className="space-y-2 mb-4">
                {multipleChoiceOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(option)}
                    disabled={showAnswer}
                    className={`w-full text-left px-4 py-3 rounded transition-colors ${
                      selectedOption === option
                        ? showAnswer
                          ? option === currentQuestion.meaning
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "bg-blue-600 text-white"
                        : showAnswer && option === currentQuestion.meaning
                        ? "bg-green-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-400">Lub wpisz odpowiedź:</label>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !showAnswer && checkAnswer()}
                  disabled={showAnswer}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Wpisz znaczenie..."
                />
              </div>
            </div>
          )}

          {questionType === "pinyin" && (
            <div className="space-y-4">
              <div className="text-lg text-neutral-300 mb-4">Jak się pisze to słowo w pinyin?</div>
              
              <div className="space-y-2 mb-4">
                {multipleChoiceOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(option)}
                    disabled={showAnswer}
                    className={`w-full text-left px-4 py-3 rounded transition-colors ${
                      selectedOption === option
                        ? showAnswer
                          ? option === currentQuestion.pinyin
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "bg-blue-600 text-white"
                        : showAnswer && option === currentQuestion.pinyin
                        ? "bg-green-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-400">Lub wpisz odpowiedź:</label>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !showAnswer && checkAnswer()}
                  disabled={showAnswer}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Wpisz pinyin..."
                />
              </div>
            </div>
          )}

          {questionType === "sentence" && (
            <div className="space-y-4">
              <div className="text-lg text-neutral-300 mb-4">Które zdanie zawiera to słowo?</div>
              
              <div className="space-y-2">
                {multipleChoiceOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(option)}
                    disabled={showAnswer}
                    className={`w-full text-left px-4 py-3 rounded transition-colors ${
                      selectedOption === option
                        ? showAnswer
                          ? option === currentQuestion.exampleSentence
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "bg-blue-600 text-white"
                        : showAnswer && option === currentQuestion.exampleSentence
                        ? "bg-green-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    <div className="text-lg mb-1">{option}</div>
                    {showAnswer && option === currentQuestion.exampleSentence && (
                      <div className="text-sm opacity-80">{currentQuestion.exampleTranslation}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Answer feedback */}
          {showAnswer && (
            <div className={`mt-6 p-4 rounded ${
              isCorrect ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"
            }`}>
              <div className={`text-lg font-semibold mb-2 ${
                isCorrect ? "text-green-400" : "text-red-400"
              }`}>
                {isCorrect 
                  ? `✓ Poprawnie! (${squares.find(sq => sq.id === currentSquareId)?.correctAnswers || 0}/${REQUIRED_CORRECT_ANSWERS})` 
                  : "✗ Niepoprawnie"}
              </div>
              <div className="text-neutral-300 space-y-1">
                <div><strong>Znaczenie:</strong> {currentQuestion.meaning}</div>
                <div><strong>Pinyin:</strong> {currentQuestion.pinyin}</div>
                <div className="mt-2">
                  <strong>Przykładowe zdanie:</strong>
                  <div className="text-lg mt-1">{currentQuestion.exampleSentence}</div>
                  <div className="text-sm text-neutral-400 mt-1">{currentQuestion.exampleTranslation}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4 mt-6">
            {!showAnswer && questionType !== "sentence" && (
              <button
                onClick={checkAnswer}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
              >
                Sprawdź odpowiedź
              </button>
            )}
            {showAnswer && (
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold"
              >
                Następne słowo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid of squares */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-4">Twoje postępy (400 słów)</h2>
        <div 
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {squares.map((square) => (
            <div
              key={square.id}
              className={`
                aspect-square flex items-center justify-center text-xs font-semibold
                transition-all duration-200 cursor-pointer
                ${getSquareClassName(square.correctAnswers)}
              `}
              title={square.correctAnswers >= REQUIRED_CORRECT_ANSWERS 
                ? `${square.word.chinese} - ${square.word.meaning}` 
                : square.correctAnswers > 0
                ? `${square.word.chinese} - ${square.correctAnswers}/${REQUIRED_CORRECT_ANSWERS}`
                : `Słowo #${square.id}`}
            >
              {square.correctAnswers >= REQUIRED_CORRECT_ANSWERS ? "✓" : square.correctAnswers > 0 ? square.correctAnswers : square.id}
            </div>
          ))}
        </div>
      </div>

      {learnedCount === TOTAL_SQUARES && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-400 mb-2">🎉 Gratulacje!</div>
          <div className="text-lg text-neutral-300">Ukończyłeś wszystkie 400 słów z poziomu HSK4!</div>
        </div>
      )}
    </div>
  );
}

