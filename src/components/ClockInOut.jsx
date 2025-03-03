/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, updateDoc, Timestamp, onSnapshot, collection } from "firebase/firestore";
import { db } from "../firebase";
import moment from "moment";
import { ToastContainer, toast } from 'react-toastify'; // Import toast components
import 'react-toastify/dist/ReactToastify.css';

const ClockInOut = ({ user }) => {
  const [clockInTime, setClockInTime] = useState(null);
  const [clockOutTime, setClockOutTime] = useState(null);
  const [isClockingIn, setIsClockingIn] = useState(false); // New state for clock-in loading
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adjustedClockIn, setAdjustedClockIn] = useState(null);
  const [adjustedClockOut, setAdjustedClockOut] = useState(null);
  const [totalHours, setTotalHours] = useState(0);
  const [status, setStatus] = useState(null);
  const [currentShift, setCurrentShift] = useState("Day Shift");
  const [attendanceData, setAttendanceData] = useState(null); // Store fetched attendance data

  const WORK_START_TIME = 9; // 9 AM (adjust as needed)
  const MINIMUM_WORK_HOURS = 9;

  useEffect(() => {
    let unsubscribe;
  
    const fetchUserData = async () => {
      const userRef = doc(db, "users", user.uid);
  
      try {
        const userDoc = await getDoc(userRef);
  
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentDate = moment().format("YYYY-MM-DD");
          const attendanceCollectionRef = collection(userRef, "attendance"); // Collection reference
          const attendanceDocRef = doc(attendanceCollectionRef, currentDate);    // Document reference
  
          const attendanceDoc = await getDoc(attendanceDocRef);
  
          if (attendanceDoc.exists()) {
            const attendance = attendanceDoc.data();
   
            setCurrentShift(attendance.shift || determineInitialShift());
            setClockInTime(attendance.clockIn?.toDate() ?? null);
            setClockOutTime(attendance.clockOut?.toDate() ?? null);
            setAdjustedClockIn(attendance.adjustedClockIn?.toDate() ?? attendance.clockIn?.toDate() ?? null);
            setAdjustedClockOut(attendance.adjustedClockOut?.toDate() ?? attendance.clockOut?.toDate() ?? null);
            setTotalHours(attendance.totalHours ?? 0);
            setAttendanceData(attendance);
            setStatus(attendance.status ?? calculateStatus(attendance.clockIn?.toDate() ?? null));
          } else {
            resetAttendanceState();
          }
  
          // Attach onSnapshot *after* initial data fetch
          unsubscribe = onSnapshot(attendanceDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const updatedAttendance = docSnapshot.data(); //Corrected line.
            setClockInTime(updatedAttendance.clockIn?.toDate() ?? null);
            setClockOutTime(updatedAttendance.clockOut?.toDate() ?? null);
            setAdjustedClockIn(updatedAttendance.adjustedClockIn?.toDate() ?? updatedAttendance.clockIn?.toDate() ?? null);
            setAdjustedClockOut(updatedAttendance.adjustedClockOut?.toDate() ?? updatedAttendance.clockOut?.toDate() ?? null);
            setTotalHours(updatedAttendance.totalHours ?? 0);
            setAttendanceData(updatedAttendance);
            setStatus(updatedAttendance.status ?? calculateStatus(updatedAttendance.clockIn?.toDate() ?? null));
            setCurrentShift(updatedAttendance.shift || determineInitialShift()); //Use the corrected variable.
            } else {
              resetAttendanceState();
            }
          });
        } else {
          resetAttendanceState();
          setCurrentShift(determineInitialShift());
        }
      } catch (error) {
        console.error("Error fetching or listening to data:", error);
        resetAttendanceState();
      }
    };
  
    const resetAttendanceState = () => {
      setClockInTime(null);
      setClockOutTime(null);
      setAdjustedClockIn(null);
      setAdjustedClockOut(null);
      setTotalHours(0);
      setAttendanceData(null);
      setStatus(null); 
    };
  
    if (user) {
      fetchUserData(); // Call the combined fetch and listen function
    }
  
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
  
    return () => {
      clearInterval(intervalId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const determineInitialShift = () => {
    const currentHour = new Date().getHours();
    return currentHour >= 18 ? "Night Shift" : "Day Shift";
  };

  const handleShiftChange = async () => {
    const newShift = currentShift === "Day Shift" ? "Night Shift" : "Day Shift";
    setCurrentShift(newShift);

    const currentDate = moment().format("YYYY-MM-DD");
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance");
    const attendanceDocRef = doc(attendanceCollectionRef, currentDate);

    try {
      await updateDoc(attendanceDocRef, {
        shift: newShift,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating shift:", error);
    }
  };

  const calculateStatus = (clockInTime) => {
    if (!clockInTime) {
      return "Absent"; // Or handle as you see fit when there is no clockInTime
    }
    

    const clockInMoment = moment(clockInTime);
    const workStartMoment = moment().startOf("day").add(WORK_START_TIME, "hours");

    return clockInMoment.isAfter(workStartMoment) ? "Late" : "On Time";
  };

  useEffect(() => {
    calculateTotalHours();
  }, [clockInTime, clockOutTime, adjustedClockIn, adjustedClockOut]);  // Recalculate on any time change

  const calculateTotalHours = () => {
    let startTime = adjustedClockIn || clockInTime;
    let endTime = adjustedClockOut || clockOutTime;

    if (startTime && endTime) {
      const diff = moment(endTime).diff(startTime);
      const duration = moment.duration(diff);
      setTotalHours(duration.asHours());
    } else {
      setTotalHours(0);
    }
  };


  const handleClockIn = async () => {
    setIsClockingIn(true);
    const now = new Date();
    const currentDate = moment().format("YYYY-MM-DD");
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance");
    const attendanceDocRef = doc(attendanceCollectionRef, currentDate);

    let shift = "Day Shift"; //Default
    const currentHour = now.getHours();
    if (currentHour >= 18) {
        shift = "Night Shift";
    }

    try {
        if (!user) {
            throw new Error("User not authenticated");
        }
        const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User document not found"); // Handle if user doc doesn't exist
      }
      const userData = userDoc.data(); // Get user data
      console.log("userData:", userData);
      if(!userData.email){
        throw new Error("User email not found");
      }
      const isActive = userData.isActive;


      const attendanceDoc = await getDoc(attendanceDocRef);

      const clockInData = {
        clockIn: Timestamp.fromDate(now),
        status: calculateStatus(now),
        adjustedClockIn: Timestamp.fromDate(now),
        email: userData.email, // Include email from user data
        name: userData.name,       // Include name from user data
        totalHours: 0,            // Initialize totalHours (will be calculated later)
        updatedAt: Timestamp.fromDate(now), // Include updatedAt
        createdAt: Timestamp.fromDate(now), // Include createdAt
        shift: shift,
      };

      if (!attendanceDoc.exists()) {
        await setDoc(attendanceDocRef, clockInData, { merge: true }); // Create new document with all fields
      } else {
        await updateDoc(attendanceDocRef, {  // Update existing document with only clock-in fields
          clockIn: Timestamp.fromDate(now),
          status: calculateStatus(now),
          adjustedClockIn: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
      }

      setClockInTime(now);
      setAdjustedClockIn(now);
   

    } catch (error) {
      console.error("Error clocking in:", error);
    } finally {
      setIsClockingIn(false);
    }
  };


const handleClockOut = async () => {
    setIsClockingOut(true);
    const now = new Date();
    const currentDate = moment().format("YYYY-MM-DD");
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance");
    const attendanceDocRef = doc(attendanceCollectionRef, currentDate);

    try {
      const attendanceDoc = await getDoc(attendanceDocRef);
      if (!attendanceDoc.exists()) {
        throw new Error("Attendance document not found");
      }

      const attendanceData = attendanceDoc.data();
      const startTime = attendanceData.adjustedClockIn?.toDate() || attendanceData.clockIn?.toDate(); // Use adjusted time if available
      const endTime = now;

      const diff = moment(endTime).diff(startTime);
      const duration = moment.duration(diff);
      const totalHours = duration.asHours();

      if (totalHours < MINIMUM_WORK_HOURS) {
        toast.error(`You must complete ${MINIMUM_WORK_HOURS} hours of shift before clocking out. Out time should be greater than ${moment(startTime).add(MINIMUM_WORK_HOURS, "hours").format("hh:mm A")}`);
        setIsClockingOut(false);
        return; // Prevent clock-out
    }

      const clockOutData = {
        clockOut: Timestamp.fromDate(now),
        adjustedClockOut: Timestamp.fromDate(now),
        totalHours: totalHours,
        updatedAt: Timestamp.fromDate(now), // Update updatedAt
      };

      await updateDoc(attendanceDocRef, clockOutData); // Update existing document

      setClockOutTime(now);
      setAdjustedClockOut(now);
      setTotalHours(totalHours);
    } catch (error) {
      console.error("Error clocking out:", error);
    } finally {
      setIsClockingOut(false);
    }
  };

  const handleAdjustClockIn = async () => {
    const currentDate = moment().format("YYYY-MM-DD");
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance"); // Get the collection reference
    const attendanceDocRef = doc(attendanceCollectionRef, currentDate); // Correct document reference

    try {
      const adjustedClockInDate = moment(adjustedClockIn).toDate();  // Convert to Date object
      const status = calculateStatus(adjustedClockInDate);

      await updateDoc(attendanceDocRef, { // Use the correct document reference
        adjustedClockIn: Timestamp.fromDate(adjustedClockIn),
        status: status,
        updatedAt: Timestamp.fromDate(new Date()) // Update the 'updatedAt' field
      });
      setClockInTime(adjustedClockIn);
    } catch (error) {
      console.error("Error adjusting clock-in:", error);
    }
  };

  const handleAdjustClockOut = async () => {
    const currentDate = moment().format("YYYY-MM-DD");
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance"); // Get the collection reference
    const attendanceDocRef = doc(attendanceCollectionRef, currentDate); // Correct document reference

    try {
      await updateDoc(attendanceDocRef, { // Use the correct document reference
        adjustedClockOut: Timestamp.fromDate(adjustedClockOut),
        updatedAt: Timestamp.fromDate(new Date()) // Update the 'updatedAt' field
      });
      setClockOutTime(adjustedClockOut);
      calculateTotalHours();
    } catch (error) {
      console.error("Error adjusting clock-out:", error);
    }
  };

  // ... (rest of your code)

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const formattedDateTime =
    currentTime.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " " +
    currentTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="bg-white dark:bg-gray-800 p-8 text-center w-100 flex items-center justify-center">
        <div className="flex items-center">
          {/* Circular Ring and Time */}
          <div className="relative mr-20">
            <div className="w-40 h-40 rounded-full border-8 border-purple-600 dark:border-purple-400 flex items-center justify-center">
              <div className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{formattedTime}</div>
            </div>
          </div>
    
          {/* Clock In/Out Section */}
          <div>
            {clockInTime === null ? (
              <button
                onClick={handleClockIn}
                className={`w-full px-4 py-2 rounded text-white bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 font-medium transition duration-300`}
                disabled={isClockingIn}
              >
                {isClockingIn ? "Clocking In..." : "Clock In"}
              </button>
            ) : clockOutTime === null ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                  Checked in at {moment(adjustedClockIn || clockInTime).format("hh:mm A")} on{" "}
                  {moment(adjustedClockIn || clockInTime).format("MMMM DD, YYYY")}
                </p>
                <button
                  onClick={handleClockOut}
                  className="w-full px-4 py-2 rounded bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium transition duration-300"
                  disabled={isClockingOut}
                >
                  {isClockingOut ? "Clocking Out..." : "Clock Out"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">You have clocked out already.</p>
                <p className="text-lg font-medium mt-2 text-gray-800 dark:text-gray-200">Total Hours: {totalHours.toFixed(2)}</p>
                <p className="text-lg font-medium mt-2 text-gray-800 dark:text-gray-200">Status: {status}</p>
    
                <div className="mt-4">
                  <p className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">Clocked Times:</p>
                  <p className="text-gray-800 dark:text-gray-200">Clock In: {moment(adjustedClockIn).format("hh:mm A")}</p>
                  <p className="text-gray-800 dark:text-gray-200">Clock Out: {moment(adjustedClockOut).format("hh:mm A")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <ToastContainer position="bottom-right" h-300px autoClose={3000} />
      </div>
    );
  };
  
  export default ClockInOut;