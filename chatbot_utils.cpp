#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <cmath>
#include <chrono>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <mutex>
#include <queue>
#include <condition_variable>
#include <cstring>
#include <stdexcept>

using namespace std;

namespace ChatBotUtils {

    class TextProcessor {
    public:
        static double calculateSimilarity(const string& str1, const string& str2) {
            // Calculate Jaccard similarity between two strings
            unordered_set<string> words1 = splitIntoWords(str1);
            unordered_set<string> words2 = splitIntoWords(str2);

            int intersectionCount = 0;
            for (const auto& word : words1) {
                if (words2.find(word) != words2.end()) {
                    intersectionCount++;
                }
            }

            int unionCount = words1.size() + words2.size() - intersectionCount;
            return unionCount > 0 ? (double)intersectionCount / unionCount : 0.0;
        }

        static vector<string> extractKeywords(const string& text, int maxKeywords = 5) {
            unordered_map<string, int> wordFrequencies;
            vector<string> words = splitIntoWords(text);

            for (const string& word : words) {
                if (word.size() > 3) { // Ignore short words
                    wordFrequencies[word]++;
                }
            }

            vector<pair<string, int>> sortedWords(wordFrequencies.begin(), wordFrequencies.end());
            sort(sortedWords.begin(), sortedWords.end(), 
                [](const pair<string, int>& a, const pair<string, int>& b) {
                    return a.second > b.second;
                });

            vector<string> keywords;
            for (int i = 0; i < min(maxKeywords, (int)sortedWords.size()); ++i) {
                keywords.push_back(sortedWords[i].first);
            }

            return keywords;
        }

        static string summarizeText(const string& text, int maxSentences = 3) {
            // Simple extractive summarization
            vector<string> sentences = splitIntoSentences(text);
            
            if (sentences.size() <= maxSentences) {
                return text;
            }

            string summary;
            for (int i = 0; i < maxSentences; ++i) {
                summary += sentences[i] + " ";
            }

            return summary;
        }

    private:
        static vector<string> splitIntoWords(const string& text) {
            vector<string> words;
            string currentWord;
            
            for (char c : text) {
                if (isalpha(c) || c == '\'') {
                    currentWord += tolower(c);
                } else if (!currentWord.empty()) {
                    words.push_back(currentWord);
                    currentWord.clear();
                }
            }
            
            if (!currentWord.empty()) {
                words.push_back(currentWord);
            }
            
            return words;
        }

        static vector<string> splitIntoSentences(const string& text) {
            vector<string> sentences;
            string currentSentence;
            
            for (char c : text) {
                currentSentence += c;
                if (c == '.' || c == '?' || c == '!') {
                    sentences.push_back(currentSentence);
                    currentSentence.clear();
                }
            }
            
            if (!currentSentence.empty()) {
                sentences.push_back(currentSentence);
            }
            
            return sentences;
        }
    };

    class PerformanceTimer {
    public:
        void start() {
            startTime = chrono::high_resolution_clock::now();
        }

        void stop() {
            endTime = chrono::high_resolution_clock::now();
        }

        long long elapsedMilliseconds() const {
            return chrono::duration_cast<chrono::milliseconds>(endTime - startTime).count();
        }

    private:
        chrono::time_point<chrono::high_resolution_clock> startTime;
        chrono::time_point<chrono::high_resolution_clock> endTime;
    };

    class ThreadPool {
    public:
        ThreadPool(size_t numThreads) : stop(false) {
            for (size_t i = 0; i < numThreads; ++i) {
                workers.emplace_back([this] {
                    while (true) {
                        function<void()> task;
                        {
                            unique_lock<mutex> lock(queueMutex);
                            condition.wait(lock, [this] {
                                return stop || !tasks.empty();
                            });
                            
                            if (stop && tasks.empty()) {
                                return;
                            }
                            
                            task = move(tasks.front());
                            tasks.pop();
                        }
                        task();
                    }
                });
            }
        }

        template<class F, class... Args>
        auto enqueue(F&& f, Args&&... args) -> future<typename result_of<F(Args...)>::type> {
            using return_type = typename result_of<F(Args...)>::type;
            
            auto task = make_shared<packaged_task<return_type()>>(
                bind(forward<F>(f), forward<Args>(args)...)
            );
            
            future<return_type> res = task->get_future();
            {
                unique_lock<mutex> lock(queueMutex);
                if (stop) {
                    throw runtime_error("enqueue on stopped ThreadPool");
                }
                tasks.emplace([task]() { (*task)(); });
            }
            condition.notify_one();
            return res;
        }

        ~ThreadPool() {
            {
                unique_lock<mutex> lock(queueMutex);
                stop = true;
            }
            condition.notify_all();
            for (thread& worker : workers) {
                worker.join();
            }
        }

    private:
        vector<thread> workers;
        queue<function<void()>> tasks;
        mutex queueMutex;
        condition_variable condition;
        bool stop;
    };
}

// Python-C++ binding interface
extern "C" {
    double calculate_similarity(const char* str1, const char* str2) {
        return ChatBotUtils::TextProcessor::calculateSimilarity(str1, str2);
    }
    
    const char** extract_keywords(const char* text, int* count) {
        vector<string> keywords = ChatBotUtils::TextProcessor::extractKeywords(text);
        *count = keywords.size();
        
        char** result = new char*[keywords.size()];
        for (size_t i = 0; i < keywords.size(); ++i) {
            result[i] = new char[keywords[i].size() + 1];
            strcpy(result[i], keywords[i].c_str());
        }
        
        return const_cast<const char**>(result);
    }
    
    void free_keywords(const char** keywords, int count) {
        for (int i = count - 1; i >= 0; --i) {
            delete[] keywords[i];
        }
        delete[] keywords;
    }
}
