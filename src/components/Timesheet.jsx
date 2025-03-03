/* eslint-disable react/prop-types */
import { useState } from "react";
import moment from "moment";
import { IoArrowBack } from "react-icons/io5";
import { doc, updateDoc, Timestamp, getDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { FiEdit3, FiSave, FiX } from "react-icons/fi";
import { ToastContainer, toast } from 'react-toastify'; // Import toast components
import 'react-toastify/dist/ReactToastify.css';

const Timesheet = ({ onBack, clockInData, user, updateClockInData }) => {
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const MINIMUM_WORK_HOURS = 9;

  const handleEdit = (record) => {
    if (record.status === "Weekend" && !record.clockIn && !record.clockOut) {
      return;
    }
    setEditingRow(record.date);
    setEditedData({
      clockIn: record.adjustedClockIn ? moment(record.adjustedClockIn).format("HH:mm") : "",
      clockOut: record.adjustedClockOut ? moment(record.adjustedClockOut).format("HH:mm") : "",
      shift: record.shift || "",
    });
  };

  const calculateTotalHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0;
    const diff = moment(clockOut).diff(clockIn);
    const duration = moment.duration(diff);
    return duration.asHours();
  };

  const calculateStatus = (clockIn, shift) => {
    if (!clockIn) return "Absent";
    const workStartTime = shift === "Day Shift" ? 9 : 21; // 9 AM for day, 9 PM for night
    const clockInMoment = moment(clockIn);
    const workStartMoment = moment(clockIn).startOf("day").add(workStartTime, "hours");
    return clockInMoment.isAfter(workStartMoment) ? "Late" : "On Time";
  };

  const handleSave = async (record) => {
    const userRef = doc(db, "users", user.uid);
    const attendanceCollectionRef = collection(userRef, "attendance");
    const attendanceDocRef = doc(attendanceCollectionRef, record.date);
  
    try {
      const recordDate = moment(record.date, "YYYY-MM-DD");
      const clockInTime = editedData.clockIn
        ? moment(`${recordDate.format("YYYY-MM-DD")} ${editedData.clockIn}`, "YYYY-MM-DD HH:mm").toDate()
        : null;
      const clockOutTime = editedData.clockOut
        ? moment(`${recordDate.format("YYYY-MM-DD")} ${editedData.clockOut}`, "YYYY-MM-DD HH:mm").toDate()
        : null;
  
      const totalHours = calculateTotalHours(clockInTime, clockOutTime);
      if (totalHours < MINIMUM_WORK_HOURS && clockInTime && clockOutTime) {
        toast.error(`You must complete ${MINIMUM_WORK_HOURS} hours of shift. Out time should be greater than ${moment(clockInTime).add(MINIMUM_WORK_HOURS, "hours").format("hh:mm A")}`);
        return; // Prevent save
    }
      const status = calculateStatus(clockInTime, editedData.shift);
  
      await updateDoc(attendanceDocRef, {
        adjustedClockIn: clockInTime ? Timestamp.fromDate(clockInTime) : null,
        adjustedClockOut: clockOutTime ? Timestamp.fromDate(clockOutTime) : null,
        shift: editedData.shift,
        totalHours: totalHours,
        status: status,
        updatedAt: Timestamp.fromDate(new Date()),
      });
  
      setEditingRow(null);
  
      // Update local state immediately
      const updatedData = {
        date: record.date,
        adjustedClockIn: clockInTime,
        adjustedClockOut: clockOutTime,
        shift: editedData.shift,
        totalHours: totalHours,
        status: status,
      };
  
      updateClockInData((prevData) =>
        prevData.map((item) => (item.date === record.date ? { ...item, ...updatedData } : item))
      );
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const handleInputChange = (e, field) => {
    setEditedData({ ...editedData, [field]: e.target.value });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 shadow-lg w-full max-w-4xl mx-auto border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4 border-b border-gray-300 dark:border-gray-700 pb-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Attendance Sheet</h2>
        <button onClick={onBack} className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 flex items-center">
          <IoArrowBack className="h-5 w-5 mr-1" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>
  
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-400 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm">
          <thead>
            <tr className="bg-violet-300 dark:bg-violet-700 text-gray-900 dark:text-gray-100 text-left border-b border-gray-500 dark:border-gray-600">
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Date</th>
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Shift</th>
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Clock In</th>
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Clock Out</th>
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Total Hours</th>
              <th className="py-3 px-4 font-semibold border border-gray-400 dark:border-gray-700">Status</th>
              <th className=""></th>
            </tr>
          </thead>
          <tbody>
            {clockInData.map((record, index) => (
              <tr
                key={record.date}
                className={`py-2 px-4 border border-gray-400 dark:border-gray-700 ${
                  index % 2 === 0 ? "bg-violet-100 dark:bg-violet-900" : "bg-white dark:bg-gray-800"
                } hover:bg-violet-200 dark:hover:bg-violet-800 transition duration-200`}
              >
                <td className="py-2 px-4">{record.date}</td>
                {record.status === "Weekend" && !record.clockIn && !record.clockOut ? (
                  <td colSpan="6" className="text-center py-4 font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900">
                    Weekend
                  </td>
                ) : editingRow === record.date ? (
                  <>
                    <td className="py-2 px-4">
                      <select
                        value={editedData.shift}
                        onChange={(e) => handleInputChange(e, "shift")}
                        className="border border-gray-500 dark:border-gray-600 px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      >
                        <option value="Day Shift">Day Shift</option>
                        <option value="Night Shift">Night Shift</option>
                      </select>
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="time"
                        value={editedData.clockIn}
                        onChange={(e) => handleInputChange(e, "clockIn")}
                        className="border border-gray-500 dark:border-gray-600 px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="time"
                        value={editedData.clockOut}
                        onChange={(e) => handleInputChange(e, "clockOut")}
                        className="border border-gray-500 dark:border-gray-600 px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      />
                    </td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">
                      {calculateTotalHours(
                        editedData.clockIn ? moment(`${record.date} ${editedData.clockIn}`).toDate() : null,
                        editedData.clockOut ? moment(`${record.date} ${editedData.clockOut}`).toDate() : null
                      ).toFixed(2)}
                    </td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">
                      {calculateStatus(
                        editedData.clockIn ? moment(`${record.date} ${editedData.clockIn}`).toDate() : null,
                        editedData.shift
                      )}
                    </td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700 space-x-2">
                      <button onClick={() => handleSave(record)} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">
                        <FiSave />
                      </button>
                      <button onClick={() => setEditingRow(null)} className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
                        <FiX />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">{record.shift || "-"}</td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">
                      {record.adjustedClockIn ? moment(record.adjustedClockIn).format("hh:mm A") : "-"}
                    </td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">
                      {record.adjustedClockOut ? moment(record.adjustedClockOut).format("hh:mm A") : "-"}
                    </td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">{record.totalHours ? record.totalHours.toFixed(2) : "-"}</td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">{record.status || "-"}</td>
                    <td className="py-2 px-4 border border-gray-400 dark:border-gray-700">
                      <button
                        onClick={() => handleEdit(record)}
                        className={`text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 ${
                          record.status === "Weekend" ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={record.status === "Weekend"}
                      >
                        <FiEdit3 />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ToastContainer position="top-right" h-300px autoClose={3000} />
    </div>
  );
};

export default Timesheet;
