import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection} from "firebase/firestore"; // Import necessary Firestore functions
import ClockInOut from "../components/ClockInOut";
import Timesheet from '../components/Timesheet';
import ClockInActivityGraph from "../components/ClockinGraph";
import moment from "moment";
import axios from "axios";
import { FaTimes,FaSun, FaMoon } from 'react-icons/fa';


const generate7DayData = async (userRef) => {
  const clockInData = [];
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const date = moment().subtract(i, 'days');
    const dateStr = date.format("YYYY-MM-DD");
    last7Days.push(dateStr);
  }

  const attendanceCollectionRef = collection(userRef, "attendance");

  const attendanceDataPromises = last7Days.map(async (dateStr) => {
    const attendanceDocRef = doc(attendanceCollectionRef, dateStr);
    const attendanceDoc = await getDoc(attendanceDocRef);

    if (attendanceDoc.exists()) {
      const data = attendanceDoc.data();
      return {
        date: dateStr,
        ...data,
        clockIn: data.adjustedClockIn?.toDate() || data.clockIn?.toDate() || null,
        clockOut: data.adjustedClockOut?.toDate() || data.clockOut?.toDate() || null,
        adjustedClockIn: data.adjustedClockIn?.toDate() || null,
        adjustedClockOut: data.adjustedClockOut?.toDate() || null,
      };
    } else {
      const dayOfWeek = moment(dateStr).format('ddd');
      const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';

      return {
        date: dateStr,
        status: isWeekend ? 'Weekend' : 'Absent',
        clockIn: null,
        clockOut: null,
        adjustedClockIn: null,
        adjustedClockOut: null,
      };
    }
  });

  const attendanceData = await Promise.all(attendanceDataPromises);
  return attendanceData;
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [clockInTime, setClockInTime] = useState(null);
  const [clockOutTime, setClockOutTime] = useState(null);
  const [showTimesheet, setShowTimesheet] = useState(false);
  const [clockInData, setClockInData] = useState([]);
  const [userName, setUserName] = useState('');
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [allHolidays, setAllHolidays] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [navHolidayIndex, setNavHolidayIndex] = useState(0);
  const [upcomingHolidayIndices, setUpcomingHolidayIndices] = useState([]);
  const [averageWorkHours, setAverageWorkHours] = useState(0);
  const [onTimePercentage, setOnTimePercentage] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const navigate = useNavigate();

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "light" : "dark");
    document.documentElement.classList.toggle("dark", !isDarkMode);
  };

  // Check for saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        navigate("/");
      } else {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setClockInTime(userData.lastClockIn?.toDate());
          setClockOutTime(userData.lastClockOut?.toDate());
          setUserName(userData.name);
      }try {
        const completeAttendanceData = await generate7DayData(userRef);
        setClockInData(completeAttendanceData);

        // Calculate average work hours
        const totalHours = completeAttendanceData.reduce((sum, day) => sum + (day.totalHours || 0), 0);
        const avgHours = completeAttendanceData.length > 0 ? totalHours / completeAttendanceData.length : 0;
        setAverageWorkHours(avgHours);

        // Calculate arrival on time percentage
        const onTimeDays = completeAttendanceData.filter((day) => day.status === 'On Time').length;
        const percentage = completeAttendanceData.length > 0 ? (onTimeDays / completeAttendanceData.length) * 100 : 0;
        setOnTimePercentage(percentage);
    } catch (error) {
        console.error("Error fetching or generating data:", error);
        setClockInData([]);
    }
  }
});   
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const year = new Date().getFullYear();
        const response = await axios.get(
          `https://calendarific.com/api/v2/holidays?&api_key=8itN8xAbWD8jgZvAG63RA59J2v03odKM&country=IN&year=${year}`
        );

        if (response.data.response && response.data.response.holidays) {
          const today = new Date();
          const holidays = response.data.response.holidays
            .filter((holiday) => new Date(holiday.date.iso) > today)
            .sort((a, b) => new Date(a.date.iso) - new Date(b.date.iso));

          const allHolidaysSorted = response.data.response.holidays.sort(
            (a, b) => new Date(a.date.iso) - new Date(b.date.iso)
          );

          setAllHolidays(allHolidaysSorted);

          if (holidays.length > 0) {
            const defaultHoliday = holidays[0];
            const formattedHoliday = {
              name: defaultHoliday.name,
              date: new Date(defaultHoliday.date.iso),
              dayOfWeek: moment(defaultHoliday.date.iso).format("dddd"),
            };
            setUpcomingHolidays([formattedHoliday]);
            setNavHolidayIndex(0);

            // Populate indices
            const indices = holidays.map((holiday) =>
              allHolidaysSorted.findIndex((h) => h.date.iso === holiday.date.iso)
            );
            setUpcomingHolidayIndices(indices);
          } else {
            console.error("No upcoming holidays found in Calendarific response.");
            setUpcomingHolidays([]);
            setNavHolidayIndex(0);
            setUpcomingHolidayIndices([]);
          }
        } else {
          console.error("No holidays found in Calendarific response.");
          setUpcomingHolidays([]);
          setNavHolidayIndex(0);
          setUpcomingHolidayIndices([]);
        }
      } catch (error) {
        console.error("Error fetching holidays:", error);
        setUpcomingHolidays([]);
        setNavHolidayIndex(0);
        setUpcomingHolidayIndices([]);
      }
    };

    fetchHolidays();
  }, []);

  const handlePrevHoliday = () => {
    if (navHolidayIndex > 0) {
      setNavHolidayIndex(navHolidayIndex - 1);
      setUpcomingHolidays([
        {
          name: allHolidays[upcomingHolidayIndices[navHolidayIndex - 1]].name,
          date: new Date(allHolidays[upcomingHolidayIndices[navHolidayIndex - 1]].date.iso),
          dayOfWeek: moment(allHolidays[upcomingHolidayIndices[navHolidayIndex - 1]].date.iso).format("dddd"),
        },
      ]);
    }
  };

  const handleNextHoliday = () => {
    if (navHolidayIndex < upcomingHolidayIndices.length - 1) {
      setNavHolidayIndex(navHolidayIndex + 1);
      setUpcomingHolidays([
        {
          name: allHolidays[upcomingHolidayIndices[navHolidayIndex + 1]].name,
          date: new Date(allHolidays[upcomingHolidayIndices[navHolidayIndex + 1]].date.iso),
          dayOfWeek: moment(allHolidays[upcomingHolidayIndices[navHolidayIndex + 1]].date.iso).format("dddd"),
        },
      ]);
    }
  };


  const handleSeeAll = () => {
    setIsModalOpen(true); // Open the modal
  };

  const handleCloseModal = () => {
    setIsModalOpen(false); // Close the modal
  };


  const handleLogout = () => {
    auth.signOut().then(() => navigate("/"));
  };

  const updateClockInData = (updatedDataFunction) => {
    setClockInData((prevClockInData) => updatedDataFunction(prevClockInData));
};

return (
  <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
    <header className="bg-white dark:bg-gray-800 p-4 shadow-md flex justify-between items-center">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Welcome, {userName || "User"}</h2>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {isDarkMode ? <FaSun className="text-yellow-400" /> : <FaMoon className="text-gray-800" />}
        </button>
        <button
          onClick={handleLogout}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-400 transition"
        >
          Logout
        </button>
        <button
          onClick={() => setShowTimesheet(true)}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-400 transition"
        >
          View Timesheet
        </button>
      </div>
    </header>

    {/* Main Content */}
    <main className="flex flex-col items-center justify-center flex-grow p-4">
      {!showTimesheet ? (
        <>
          {/* Top Row: ClockInOut and Upcoming Holidays */}
          <div className="max-w-6xl grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Clock In/Out Card */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md row-span-2 md:col-span-2">
              <ClockInOut
                user={user}
                setClockInTime={setClockInTime}
                setClockOutTime={setClockOutTime}
                clockInTime={clockInTime}
                clockOutTime={clockOutTime}
              />
            </div>

            {/* Average Work Hours Card */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Avg. Work Hrs</h3>
              <p className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">{averageWorkHours.toFixed(2)} hrs</p>
            </div>

            {/* Arrival On Time Card */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Arrival On Time</h3>
              <p className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">{onTimePercentage.toFixed(0)}%</p>
            </div>

            {/* Upcoming Holidays Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg md:col-span-2">
              {/* Header Section */}
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Upcoming Holiday</h3>
                <button onClick={handleSeeAll} className="text-sm text-blue-600 dark:text-gray-200 hover:underline">
                  See All &gt;
                </button>
              </div>

              {/* Holiday Summary */}
              {upcomingHolidays.length > 0 ? (
                <div className="flex flex-col space-y-2">
                  {/* Show the next upcoming holiday */}
                  <div className="flex flex-col p-4 bg-green-100 dark:bg-purple-500 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-200">
                        {moment(upcomingHolidays[0].date).format("DD MMM YYYY")} • {upcomingHolidays[0].dayOfWeek}
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-1">
                      {upcomingHolidays[0].name}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No upcoming holidays</p>
              )}
            </div>
          </div>

          {/* Bottom Row: Graph */}
          <div className="w-full max-w-6xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="w-full h-64">
              <ClockInActivityGraph clockInData={clockInData} isDarkMode={isDarkMode}/>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <Timesheet
            user={user}
            onBack={() => setShowTimesheet(false)}
            clockInData={clockInData}
            updateClockInData={updateClockInData}
          />
        </div>
      )}
    </main>

    {/* Modal for All Holidays */}
    {isModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-2xl p-6">
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">All Holidays</h3>
            <button
              onClick={handleCloseModal}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>

          {/* Group Holidays by Month */}
          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(
              allHolidays.reduce((acc, holiday) => {
                const month = moment(holiday.date.iso).format("MMMM YYYY");
                if (!acc[month]) acc[month] = [];
                acc[month].push(holiday);
                return acc;
              }, {})
            ).map(([month, holidays]) => (
              <div key={month} className="mb-4">
                <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{month}</h4>
                <ul className="space-y-2">
                  {holidays.map((holiday) => (
                    <li
                      key={holiday.date.iso}
                      className="p-3 border-b border-gray-200 dark:border-gray-700 last:border-0"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {moment(holiday.date.iso).format("DD MMM")} • {moment(holiday.date.iso).format("dddd")}
                        </span>
                        <p className="mt-1 sm:mt-0 font-semibold text-gray-800 dark:text-gray-200">
                          {holiday.name}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default Dashboard;


