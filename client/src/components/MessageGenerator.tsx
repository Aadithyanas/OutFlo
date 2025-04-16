
import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, RefreshCw, Send, User, Briefcase, Building, MapPin, FileText } from "lucide-react"
import type { LinkedInProfile } from "../types"
import { api } from "../api"

export const MessageGenerator: React.FC = () => {
  const [profile, setProfile] = useState<LinkedInProfile>({
    name: "",
    job_title: "",
    company: "",
    location: "",
    summary: "",
  })
  const [message, setMessage] = useState<string>("")
  const [displayedMessage, setDisplayedMessage] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [typingIndex, setTypingIndex] = useState(0)

  // Typing animation effect
  useEffect(() => {
    if (message && typingIndex < message.length) {
      const timer = setTimeout(() => {
        setDisplayedMessage(message.substring(0, typingIndex + 1))
        setTypingIndex(typingIndex + 1)
      }, 15) // Speed of typing
      return () => clearTimeout(timer)
    }
  }, [message, typingIndex])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await api.generateMessage(profile)
      setMessage(response.data.message)
      setDisplayedMessage("")
      setTypingIndex(0)
    } catch (error) {
      console.error("Error generating message:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof LinkedInProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  // Sample profile data for testing
  const loadSampleData = () => {
    setProfile({
      name: "John Doe",
      job_title: "Software Engineer",
      company: "TechCorp",
      location: "San Francisco, CA",
      summary:
        "Experienced in AI & ML with 5+ years of industry experience. Leading technical initiatives and driving innovation in cloud computing and distributed systems.",
    })
  }

  const formFields = [
    { icon: <User className="h-5 w-5" />, label: "Name", field: "name" as keyof LinkedInProfile },
    { icon: <Briefcase className="h-5 w-5" />, label: "Job Title", field: "job_title" as keyof LinkedInProfile },
    { icon: <Building className="h-5 w-5" />, label: "Company", field: "company" as keyof LinkedInProfile },
    { icon: <MapPin className="h-5 w-5" />, label: "Location", field: "location" as keyof LinkedInProfile },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Summary",
      field: "summary" as keyof LinkedInProfile,
      isTextarea: true,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6 min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white  bg-gradient-to-br from-red-400 via-gray-900 to-blue-200"
    >
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center mb-6"
        >
          <h1 className="text-3xl font-bold text-blue-400">LinkedIn Message Generator</h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadSampleData}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4" />
            Load Sample
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formFields.map((item, index) => (
              <motion.div
                key={item.field}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
              >
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </label>
                {item.isTextarea ? (
                  <motion.textarea
                    whileFocus={{ boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.5)" }}
                    value={profile[item.field]}
                    onChange={(e) => handleInputChange(item.field, e.target.value)}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
                    rows={4}
                    required
                  />
                ) : (
                  <motion.input
                    whileFocus={{ boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.5)" }}
                    type="text"
                    value={profile[item.field]}
                    onChange={(e) => handleInputChange(item.field, e.target.value)}
                    className="mt-1 block w-full p-2 rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
                    required
                  />
                )}
              </motion.div>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2 ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Generate Message
                </>
              )}
            </motion.button>
          </form>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6 overflow-hidden"
              >
                <h2 className="text-lg font-medium text-blue-400 mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Generated Message:
                </h2>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-700 p-4 rounded-lg border border-gray-600"
                >
                  <p className="text-gray-200 whitespace-pre-wrap">
                    {displayedMessage}
                    <span className="inline-block w-1 h-4 ml-1 bg-blue-400 animate-pulse"></span>
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}
