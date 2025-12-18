"use client";

import { useState, useEffect } from "react";
import { HSK4Word, getRandomWord, getRandomWords, hsk4Vocabulary } from "@/lib/hsk4-vocabulary";
import ChineseLearningGrid from "./ChineseLearningGrid";

type ExerciseMode = "meaning" | "pinyin" | "sentence";

export default function ChineseLearningView() {
  const [viewMode, setViewMode] = useState<"grid" | "practice">("grid");
  
  if (viewMode === "grid") {
    return (
      <div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode("grid")}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Siatka 400 słów
          </button>
          <button
            onClick={() => setViewMode("practice")}
            className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            Tryb ćwiczeń
          </button>
        </div>
        <ChineseLearningGrid />
      </div>
    );
  }

  const [currentWord, setCurrentWord] = useState<HSK4Word | null>(null);
  const [mode, setMode] = useState<ExerciseMode>("meaning");
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    loadNewWord();
  }, [mode]);

  const loadNewWord = () => {
    const word = getRandomWord();
    setCurrentWord(word);
    setUserAnswer("");
    setShowAnswer(false);
    setIsCorrect(null);
    setSelectedOption(null);
    
    if (mode === "meaning") {
      const options = getRandomWords(3, word.id).map(w => w.meaning);
      options.push(word.meaning);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    } else if (mode === "pinyin") {
      const options = getRandomWords(3, word.id).map(w => w.pinyin);
      options.push(word.pinyin);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    } else if (mode === "sentence") {
      const options = getRandomWords(3, word.id).map(w => w.exampleSentence);
      options.push(word.exampleSentence);
      setMultipleChoiceOptions(options.sort(() => Math.random() - 0.5));
    }
  };

  const checkAnswer = () => {
    if (!currentWord) return;

    let correct = false;
    if (mode === "meaning") {
      correct = userAnswer.toLowerCase().trim() === currentWord.meaning.toLowerCase().trim() ||
                selectedOption === currentWord.meaning;
    } else if (mode === "pinyin") {
      correct = userAnswer.toLowerCase().trim() === currentWord.pinyin.toLowerCase().trim() ||
                selectedOption === currentWord.pinyin;
    } else if (mode === "sentence") {
      correct = selectedOption === currentWord.exampleSentence;
    }

    setIsCorrect(correct);
    setShowAnswer(true);
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1
    }));
  };

  const handleNext = () => {
    loadNewWord();
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (mode === "sentence") {
      // Auto-check for sentence mode
      setTimeout(() => {
        const correct = option === currentWord?.exampleSentence;
        setIsCorrect(correct);
        setShowAnswer(true);
        setScore(prev => ({
          correct: prev.correct + (correct ? 1 : 0),
          total: prev.total + 1
        }));
      }, 300);
    }
  };

  if (!currentWord) {
    return <div className="text-neutral-400">Ładowanie...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode("grid")}
          className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
        >
          Siatka 400 słów
        </button>
        <button
          onClick={() => setViewMode("practice")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Tryb ćwiczeń
        </button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Nauka chińskiego - HSK4</h1>
        <div className="text-sm text-neutral-400">
          Wynik: {score.correct}/{score.total} ({score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%)
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("meaning")}
          className={`px-4 py-2 rounded transition-colors ${
            mode === "meaning"
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Zgadnij znaczenie
        </button>
        <button
          onClick={() => setMode("pinyin")}
          className={`px-4 py-2 rounded transition-colors ${
            mode === "pinyin"
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Zgadnij pinyin
        </button>
        <button
          onClick={() => setMode("sentence")}
          className={`px-4 py-2 rounded transition-colors ${
            mode === "sentence"
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Dopasuj do zdania
        </button>
      </div>

      {/* Exercise card */}
      <div className="bg-neutral-900 rounded-lg p-8 border border-neutral-800">
        {/* Chinese word display - hide in sentence mode */}
        {mode !== "sentence" && (
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-white mb-4">{currentWord.chinese}</div>
            {showAnswer && (
              <div className="text-2xl text-neutral-400 mb-2">{currentWord.pinyin}</div>
            )}
          </div>
        )}
        {mode === "sentence" && (
          <div className="text-center mb-8">
            {showAnswer ? (
              <>
                <div className="text-6xl font-bold text-white mb-4">{currentWord.chinese}</div>
                <div className="text-2xl text-neutral-400 mb-2">{currentWord.pinyin}</div>
              </>
            ) : (
              <div className="text-2xl text-neutral-500 mb-4">???</div>
            )}
          </div>
        )}

        {/* Exercise content based on mode */}
        {mode === "meaning" && (
          <div className="space-y-4">
            <div className="text-lg text-neutral-300 mb-4">Jakie jest znaczenie tego słowa?</div>
            
            {/* Multiple choice */}
            <div className="space-y-2 mb-4">
              {multipleChoiceOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  disabled={showAnswer}
                  className={`w-full text-left px-4 py-3 rounded transition-colors ${
                    selectedOption === option
                      ? showAnswer
                        ? option === currentWord.meaning
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                      : showAnswer && option === currentWord.meaning
                      ? "bg-green-600 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Text input (alternative) */}
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

        {mode === "pinyin" && (
          <div className="space-y-4">
            <div className="text-lg text-neutral-300 mb-4">Jak się pisze to słowo w pinyin?</div>
            
            {/* Multiple choice */}
            <div className="space-y-2 mb-4">
              {multipleChoiceOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  disabled={showAnswer}
                  className={`w-full text-left px-4 py-3 rounded transition-colors ${
                    selectedOption === option
                      ? showAnswer
                        ? option === currentWord.pinyin
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                      : showAnswer && option === currentWord.pinyin
                      ? "bg-green-600 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Text input (alternative) */}
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

        {mode === "sentence" && (
          <div className="space-y-4">
            <div className="text-lg text-neutral-300 mb-4">Które zdanie zawiera to słowo?</div>
            
            {/* Multiple choice sentences */}
            <div className="space-y-2">
              {multipleChoiceOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  disabled={showAnswer}
                  className={`w-full text-left px-4 py-3 rounded transition-colors ${
                    selectedOption === option
                      ? showAnswer
                        ? option === currentWord.exampleSentence
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                      : showAnswer && option === currentWord.exampleSentence
                      ? "bg-green-600 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  <div className="text-lg mb-1">{option}</div>
                  {showAnswer && option === currentWord.exampleSentence && (
                    <div className="text-sm opacity-80">{currentWord.exampleTranslation}</div>
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
              {isCorrect ? "✓ Poprawnie!" : "✗ Niepoprawnie"}
            </div>
            <div className="text-neutral-300 space-y-1">
              <div><strong>Znaczenie:</strong> {currentWord.meaning}</div>
              <div><strong>Pinyin:</strong> {currentWord.pinyin}</div>
              <div className="mt-2">
                <strong>Przykładowe zdanie:</strong>
                <div className="text-lg mt-1">{currentWord.exampleSentence}</div>
                <div className="text-sm text-neutral-400 mt-1">{currentWord.exampleTranslation}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 mt-6">
          {!showAnswer && mode !== "sentence" && (
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

      {/* Statistics */}
      <div className="text-sm text-neutral-400 text-center">
        Słownictwo HSK4: {hsk4Vocabulary.length} słów
      </div>
    </div>
  );
}
