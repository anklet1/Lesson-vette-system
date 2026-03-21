/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  getDocFromServer,
  arrayUnion,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  LayoutDashboard, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  LogOut, 
  Settings,
  ChevronRight, 
  ChevronLeft,
  Minus,
  Search,
  CheckCircle2,
  AlertCircle,
  School,
  User as UserIcon,
  BarChart3,
  Timer,
  MessageSquare,
  X,
  Filter,
  TrendingUp,
  Target,
  Upload,
  Download,
  Archive,
  FileUp,
  FolderArchive,
  Eye,
  Trash2,
  Paperclip,
  Bell
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';
import { pdfjs, Document, Page } from 'react-pdf';
import * as docx from 'docx-preview';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { auth, db, storage } from './firebase';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { ChatBot } from './components/ChatBot';

// --- Types ---

type UserRole = 'teacher' | 'headteacher' | 'siso';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId: string;
}

interface VettingAction {
  status: 'vetted' | 'rejected';
  feedback: string;
  vettedBy: string;
  vettedByName: string;
  vettedAt: string;
}

interface LessonNote {
  id: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  subject: string;
  week: number;
  term: string;
  academicYear: string;
  date: string;
  content: string;
  status: 'pending' | 'vetted' | 'rejected';
  submittedAt: string;
  vettedBy?: string;
  vetterName?: string;
  vetterRole?: string;
  vettedAt?: string;
  feedback?: string;
  vettingHistory?: VettingAction[];
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  isArchived?: boolean;
  tlrs?: string;
  tlrFileUrl?: string;
  tlrFileName?: string;
  tlrFileType?: string;
}

interface TermSettings {
  id: string;
  currentTerm: string;
  academicYear: string;
  updatedAt: string;
  updatedBy: string;
}

interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'deadline' | 'overdue' | 'vetted' | 'rejected' | 'vetting_overdue';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

interface School {
  id: string;
  name: string;
  district: string;
  createdAt: string;
  createdBy: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Helpers ---

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const DocumentPreview = ({ fileUrl, fileType, fileName }: { fileUrl: string, fileType: string, fileName: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const docxContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fileType.includes('officedocument.wordprocessingml.document') && docxContainerRef.current) {
      // Handle DOCX
      fetch(fileUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = '';
            docx.renderAsync(buffer, docxContainerRef.current);
          }
        });
    }
  }, [fileUrl, fileType]);

  if (fileType === 'application/pdf') {
    return (
      <div className="flex flex-col items-center w-full h-full max-h-[500px] overflow-hidden">
        <div className="flex items-center gap-4 mb-4 p-2 bg-stone-100 rounded-xl w-full justify-center sticky top-0 z-10 shadow-sm">
          <button 
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
            className="p-1.5 hover:bg-white rounded-lg disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-stone-600">
            Page {pageNumber} of {numPages || '?'}
          </span>
          <button 
            type="button"
            disabled={numPages !== null && pageNumber >= numPages}
            onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || prev))}
            className="p-1.5 hover:bg-white rounded-lg disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="h-4 w-[1px] bg-stone-300 mx-2" />
          <button 
            type="button"
            onClick={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
            className="p-1.5 hover:bg-white rounded-lg transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold text-stone-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button 
            type="button"
            onClick={() => setScale(prev => Math.min(prev + 0.2, 2.0))}
            className="p-1.5 hover:bg-white rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 w-full overflow-auto bg-stone-200 p-4 rounded-xl flex justify-center">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="flex flex-col items-center gap-2 py-10">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-stone-500">Loading PDF...</span>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              className="shadow-xl"
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        </div>
      </div>
    );
  }

  if (fileType.includes('officedocument.wordprocessingml.document')) {
    return (
      <div className="w-full h-full max-h-[500px] overflow-auto bg-white p-4 rounded-xl border border-stone-100">
        <div ref={docxContainerRef} className="docx-preview-container" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-stone-400 py-10">
      <FileText className="w-10 h-10" />
      <span className="text-xs">Preview not available for this file type</span>
      <p className="text-[10px]">{fileName}</p>
    </div>
  );
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMsg(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Badge = ({ status }: { status: LessonNote['status'] }) => {
  const styles = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    vetted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [view, setView] = useState<'dashboard' | 'submit' | 'list' | 'vetting' | 'settings' | 'users'>('dashboard');
  const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string, type: string, name: string } | null>(null);
  const [vettingStatus, setVettingStatus] = useState<'vetted' | 'rejected'>('vetted');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'vetted' | 'rejected'>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [mainFilePreview, setMainFilePreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [tlrFilePreview, setTlrFilePreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [tlrFile, setTlrFile] = useState<File | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [mainUploadProgress, setMainUploadProgress] = useState<number | null>(null);
  const [tlrUploadProgress, setTlrUploadProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [termSettings, setTermSettings] = useState<TermSettings | null>(null);
  const [showSchoolManagement, setShowSchoolManagement] = useState(false);
  const [isRegisteringSchool, setIsRegisteringSchool] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    setSelectedNoteIds([]);
  }, [view, statusFilter]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setIsNewUser(false);
          } else {
            setIsNewUser(true);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setProfile(null);
        setIsNewUser(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // Real-time Notes Listener
  useEffect(() => {
    if (!profile) return;

    let q;
    if (profile.role === 'teacher') {
      q = query(collection(db, 'lessonNotes'), where('teacherId', '==', profile.uid), orderBy('submittedAt', 'desc'), limit(100));
    } else if (profile.role === 'headteacher') {
      q = query(collection(db, 'lessonNotes'), where('schoolId', '==', profile.schoolId), orderBy('submittedAt', 'desc'), limit(100));
    } else {
      q = query(collection(db, 'lessonNotes'), orderBy('submittedAt', 'desc'), limit(100));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonNote));
      setNotes(notesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lessonNotes');
    });

    return () => unsubscribe();
  }, [profile]);

  // Real-time Schools Listener
  useEffect(() => {
    if (!user) return;
    
    // Only start listener if we have a valid auth state
    const q = query(collection(db, 'schools'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schoolsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(schoolsData);
    }, (error) => {
      // If it's a permission error, we might still be authenticating
      if (error.message.includes('permission')) {
        console.warn('Schools listener: Waiting for full authentication...');
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });
    return () => unsubscribe();
  }, [user]);

  // Teachers Listener (for headteachers and SISOs)
  useEffect(() => {
    if (!profile || (profile.role !== 'headteacher' && profile.role !== 'siso')) return;

    let q;
    if (profile.role === 'headteacher') {
      q = query(collection(db, 'users'), where('schoolId', '==', profile.schoolId), where('role', '==', 'teacher'));
    } else if (profile.role === 'siso') {
      q = query(collection(db, 'users'), where('role', 'in', ['teacher', 'headteacher']));
    } else {
      q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setTeachers(teachersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [profile]);

  // Term Settings Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'settings'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const settingsData = snapshot.docs[0].data();
        setTermSettings({ id: snapshot.docs[0].id, ...settingsData } as TermSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'settings');
    });
    return () => unsubscribe();
  }, [user]);

  // Notifications Listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setAppNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, [profile]);

  // Automated Deadline Check
  useEffect(() => {
    if (!profile || profile.role !== 'teacher' || notes.length === 0) return;

    const checkDeadlines = async () => {
      const today = new Date();
      const currentWeek = 12; // Assuming we are in week 12 for demo
      const nextWeek = 13;
      const day = today.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri

      // Check for overdue notes (current week)
      const currentWeekNote = notes.find(n => n.week === currentWeek && !n.isArchived);
      if (day >= 1 && !currentWeekNote) {
        const existing = appNotifications.find(n => n.type === 'overdue' && n.message.includes(`Week ${currentWeek}`));
        if (!existing) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: profile.uid,
              title: 'Overdue Lesson Note',
              message: `Urgent: Your lesson note for Week ${currentWeek} is overdue. Please submit it as soon as possible.`,
              type: 'overdue',
              isRead: false,
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Error creating overdue notification:", e);
          }
        }
      }

      // Check for upcoming deadline (next week)
      const nextWeekNote = notes.find(n => n.week === nextWeek && !n.isArchived);
      if ((day === 4 || day === 5) && !nextWeekNote) {
        const existing = appNotifications.find(n => n.type === 'deadline' && n.message.includes(`Week ${nextWeek}`));
        if (!existing) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: profile.uid,
              title: 'Upcoming Deadline',
              message: `Reminder: Your lesson note for Week ${nextWeek} is due by Friday.`,
              type: 'deadline',
              isRead: false,
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Error creating deadline notification:", e);
          }
        }
      }
    };

    // Run check once per session/login
    checkDeadlines();
  }, [profile, notes, appNotifications]);

  // Automated Vetting Deadline Check (for headteachers)
  useEffect(() => {
    if (!profile || profile.role === 'teacher' || notes.length === 0) return;

    const checkVettingDeadlines = async () => {
      const pendingNotes = notes.filter(n => n.status === 'pending');
      const now = new Date();

      for (const note of pendingNotes) {
        const submittedDate = new Date(note.submittedAt);
        const diffHours = (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60);

        if (diffHours > 48) {
          const existing = appNotifications.find(n => n.type === 'vetting_overdue' && n.message.includes(note.teacherName) && n.message.includes(note.subject));
          if (!existing) {
            try {
              await addDoc(collection(db, 'notifications'), {
                userId: profile.uid,
                title: 'Vetting Overdue',
                message: `The lesson note from ${note.teacherName} for ${note.subject} (Week ${note.week}) has been pending for over 48 hours.`,
                type: 'vetting_overdue',
                isRead: false,
                createdAt: new Date().toISOString(),
                link: note.id
              });
            } catch (e) {
              console.error("Error creating vetting overdue notification:", e);
            }
          }
        }
      }
    };

    checkVettingDeadlines();
  }, [profile, notes, appNotifications]);

  const [loginMode, setLoginMode] = useState<'staff-login' | 'staff-register' | 'google'>('staff-login');
  const [loginRole, setLoginRole] = useState<UserRole>('teacher');
  const [loginName, setLoginName] = useState('');
  const [loginSchoolId, setLoginSchoolId] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const generateStaffEmail = (name: string, emisCode: string) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanSchool = emisCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanName}.${cleanSchool}@eduvette.local`;
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const email = generateStaffEmail(loginName, loginSchoolId);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, loginSchoolId);
      
      // Verify role matches
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        // Developer can bypass role check
        if (userCredential.user.email !== 'flekufelix@gmail.com' && userData.role !== loginRole) {
          await signOut(auth);
          setLoginError(`Access denied. Your account is registered as a ${userData.role.toUpperCase()}, not a ${loginRole.toUpperCase()}.`);
          return;
        }
      }
    } catch (error: any) {
      console.error('Staff login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('Account not found. Please check your name and EMIS code, or register first.');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Incorrect EMIS code.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
    }
  };

  const handleStaffRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('name') as string;
    const role = formData.get('role') as UserRole;
    const emisCode = formData.get('emisCode') as string;

    // Validate emisCode
    const school = schools.find(s => s.id === emisCode);
    if (!school && role !== 'siso') {
      setLoginError('Invalid EMIS code. Contact Edubyte Africa Inc (0543521863) to get one.');
      return;
    }

    if (emisCode.length < 6) {
      setLoginError('EMIS code must be at least 6 characters long.');
      return;
    }

    const email = generateStaffEmail(name, emisCode);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, emisCode);
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        name,
        email: email, 
        role,
        schoolId: role === 'siso' ? 'DISTRICT_OFFICE' : emisCode,
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      setProfile(newProfile);
      setIsNewUser(false);
      addToast('Account created successfully!', 'success');
    } catch (error: any) {
      console.error('Staff registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setLoginError('An account with this name and EMIS code already exists.');
      } else {
        setLoginError('Registration failed. Please try again.');
      }
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const switchRole = async (newRole: UserRole) => {
    if (!profile) return;
    try {
      const docRef = doc(db, 'users', profile.uid);
      const currentSchoolId = profile.schoolId || 'SCH-001';
      const updateData = { 
        role: newRole,
        schoolId: newRole === 'siso' ? 'DISTRICT_OFFICE' : (currentSchoolId === 'DISTRICT_OFFICE' ? 'SCH-001' : currentSchoolId)
      };
      await updateDoc(docRef, updateData);
      setProfile({ ...profile, ...updateData });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'tlr') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      addToast("File size exceeds 1MB limit for this demo.", "error");
      e.target.value = '';
      return;
    }

    const preview = {
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type
    };

    if (type === 'main') {
      setMainFile(file);
      setMainFilePreview(preview);
    } else {
      setTlrFile(file);
      setTlrFilePreview(preview);
    }
    
    addToast(`${file.name} selected successfully!`);
  };

  const submitNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    
    if (!mainFile) {
      alert("Please upload the lesson note file.");
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload Main File
      setMainUploadProgress(0);
      const mainRef = ref(storage, `lesson-notes/${Date.now()}-${mainFile.name}`);
      const mainUploadTask = uploadBytesResumable(mainRef, mainFile);
      
      const mainUrl = await new Promise<string>((resolve, reject) => {
        mainUploadTask.on('state_changed', 
          (snapshot) => {
            setMainUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          reject,
          () => getDownloadURL(mainUploadTask.snapshot.ref).then(resolve)
        );
      });
      setMainUploadProgress(null);

      // 2. Upload TLR File if exists
      let tlrUrl = null;
      if (tlrFile) {
        setTlrUploadProgress(0);
        const tlrRef = ref(storage, `tlrs/${Date.now()}-${tlrFile.name}`);
        const tlrUploadTask = uploadBytesResumable(tlrRef, tlrFile);
        
        tlrUrl = await new Promise<string>((resolve, reject) => {
          tlrUploadTask.on('state_changed', 
            (snapshot) => {
              setTlrUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            },
            reject,
            () => getDownloadURL(tlrUploadTask.snapshot.ref).then(resolve)
          );
        });
        setTlrUploadProgress(null);
      }

      const formData = new FormData(e.currentTarget);
      const noteData = {
        teacherId: profile.uid,
        teacherName: profile.name,
        schoolId: profile.schoolId,
        subject: formData.get('subject') as string,
        week: parseInt(formData.get('week') as string),
        term: termSettings?.currentTerm || 'Term 1',
        academicYear: termSettings?.academicYear || '2023/2024',
        date: formData.get('date') as string,
        content: formData.get('content') as string || '',
        tlrs: formData.get('tlrs') as string || '',
        status: 'pending',
        submittedAt: new Date().toISOString(),
        isArchived: false,
        fileUrl: mainUrl,
        fileName: mainFile.name,
        fileType: mainFile.type,
        tlrFileUrl: tlrUrl,
        tlrFileName: tlrFile?.name || null,
        tlrFileType: tlrFile?.type || null,
      };

      await addDoc(collection(db, 'lessonNotes'), noteData);
      setMainFile(null);
      setMainFilePreview(null);
      setTlrFile(null);
      setTlrFilePreview(null);
      setView('list');
      addToast("Lesson note submitted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'lessonNotes');
      setMainUploadProgress(null);
      setTlrUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      addToast(`User role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const archiveNote = async (noteId: string, isArchived: boolean) => {
    try {
      await updateDoc(doc(db, 'lessonNotes', noteId), { isArchived });
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, isArchived });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lessonNotes/${noteId}`);
    }
  };

  const vetNote = async (noteId: string, status: 'vetted' | 'rejected', feedback: string) => {
    if (!profile) return;
    const vettingAction: VettingAction = {
      status,
      feedback,
      vettedBy: profile.uid,
      vettedByName: `${profile.name} (${profile.role === 'siso' ? 'SISO' : 'Headteacher'})`,
      vettedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'lessonNotes', noteId), {
        status,
        feedback,
        vettedBy: profile.uid,
        vettingHistory: arrayUnion(vettingAction)
      });

      // Create notification for teacher
      const note = notes.find(n => n.id === noteId);
      if (note) {
        await addDoc(collection(db, 'notifications'), {
          userId: note.teacherId,
          title: status === 'vetted' ? 'Lesson Note Vetted' : 'Lesson Note Rejected',
          message: `Your lesson note for Week ${note.week} (${note.subject}) has been ${status}.`,
          type: status,
          isRead: false,
          createdAt: new Date().toISOString(),
          link: note.id
        });
      }

      addToast(`Note ${status} successfully!`);
      setSelectedNote(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `lessonNotes/${noteId}`);
    }
  };

  const handleNoteClick = (note: LessonNote) => {
    setSelectedNote(note);
    setVettingStatus('vetted');
  };

  const toggleSelectAll = () => {
    if (selectedNoteIds.length === filteredNotes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(filteredNotes.map(n => n.id));
    }
  };

  const toggleSelectNote = (id: string) => {
    setSelectedNoteIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (status: 'vetted' | 'rejected') => {
    if (!profile || selectedNoteIds.length === 0 || isBulkProcessing) return;
    
    setIsBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedNoteIds.forEach(id => {
        const noteRef = doc(db, 'lessonNotes', id);
        batch.update(noteRef, {
          status,
          vettedAt: new Date().toISOString(),
          vettedBy: auth.currentUser?.uid,
          vetterName: profile.name,
          vetterRole: profile.role,
          feedback: `Bulk ${status} by ${profile.role}`
        });
      });
      await batch.commit();
      setSelectedNoteIds([]);
      alert(`Successfully ${status} ${selectedNoteIds.length} notes.`);
    } catch (error) {
      console.error("Bulk action error:", error);
      alert("Failed to process bulk action. Please check permissions.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const updateTermSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || profile.role !== 'siso') return;

    const formData = new FormData(e.currentTarget);
    const newSettings = {
      currentTerm: formData.get('currentTerm') as string,
      academicYear: formData.get('academicYear') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: profile.uid,
    };

    try {
      if (termSettings) {
        await updateDoc(doc(db, 'settings', termSettings.id), newSettings);
      } else {
        await addDoc(collection(db, 'settings'), newSettings);
      }
      addToast('Settings updated successfully', 'success');
    } catch (error) {
      console.error('Error updating settings:', error);
      addToast('Failed to update settings', 'error');
    }
  };

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(notes.map(n => n.subject));
    return Array.from(subjects).sort();
  }, [notes]);

  const uniqueWeeks = useMemo(() => {
    const weeks = new Set(notes.map(n => n.week));
    return Array.from(weeks).sort((a, b) => a - b);
  }, [notes]);

  const uniqueTerms = useMemo(() => {
    const terms = new Set(notes.map(n => n.term));
    return Array.from(terms).sort();
  }, [notes]);

  const uniqueYears = useMemo(() => {
    const years = new Set(notes.map(n => n.academicYear));
    return Array.from(years).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const school = schools.find(s => s.id === note.schoolId);
      const matchesSearch = 
        note.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.schoolId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school?.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (school?.district.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
      const matchesSubject = subjectFilter === 'all' || note.subject === subjectFilter;
      const matchesWeek = weekFilter === 'all' || note.week.toString() === weekFilter;
      const matchesTerm = termFilter === 'all' || note.term === termFilter;
      const matchesYear = yearFilter === 'all' || note.academicYear === yearFilter;
      
      let matchesDateRange = true;
      if (startDateFilter) {
        matchesDateRange = matchesDateRange && new Date(note.date) >= new Date(startDateFilter);
      }
      if (endDateFilter) {
        matchesDateRange = matchesDateRange && new Date(note.date) <= new Date(endDateFilter);
      }

      const matchesArchived = showArchived ? note.isArchived : !note.isArchived;

      return matchesSearch && matchesStatus && matchesSubject && matchesWeek && matchesTerm && matchesYear && matchesDateRange && matchesArchived;
    });
  }, [notes, schools, searchTerm, statusFilter, subjectFilter, weekFilter, termFilter, yearFilter, startDateFilter, endDateFilter, showArchived]);

  // --- Metrics Calculation ---
  const currentWeek = 12; // Assuming we are in week 12 for demo

  const triggerAlert = async (teacher: UserProfile) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: teacher.uid,
        title: 'Lesson Note Submission Alert',
        message: `Your headteacher has requested that you submit your lesson notes for Week ${currentWeek} immediately.`,
        type: 'overdue',
        isRead: false,
        createdAt: new Date().toISOString()
      });
      addToast(`Alert sent to ${teacher.name}`, 'success');
    } catch (e) {
      console.error("Error triggering alert:", e);
      addToast("Failed to send alert", 'error');
    }
  };

  const metrics = useMemo(() => {
    if (!profile) return {
      total: 0, vetted: 0, pending: 0, rejected: 0, avgVettingTimeHours: '0',
      chartData: [], barData: [], teacherPerformance: [], schoolPerformance: [], recentFeedback: []
    };

    const total = notes.length;
    const vetted = notes.filter(n => n.status === 'vetted').length;
    const pending = notes.filter(n => n.status === 'pending').length;
    const rejected = notes.filter(n => n.status === 'rejected').length;

    // Calculate Average Vetting Time
    const vettedNotes = notes.filter(n => n.status === 'vetted' && n.vettedAt && n.submittedAt);
    const totalVettingTimeMs = vettedNotes.reduce((acc, note) => {
      const diff = new Date(note.vettedAt!).getTime() - new Date(note.submittedAt).getTime();
      return acc + diff;
    }, 0);
    const avgVettingTimeHours = vettedNotes.length > 0 
      ? (totalVettingTimeMs / (1000 * 60 * 60 * vettedNotes.length)).toFixed(1) 
      : '0';

    const chartData = [
      { name: 'Vetted', value: vetted, fill: '#10b981' },
      { name: 'Pending', value: pending, fill: '#f59e0b' },
      { name: 'Rejected', value: rejected, fill: '#f43f5e' },
    ];

    // Weekly submissions
    const weeklyData: Record<number, number> = {};
    notes.forEach(n => {
      weeklyData[n.week] = (weeklyData[n.week] || 0) + 1;
    });
    const barData = Object.entries(weeklyData).map(([week, count]) => ({
      week: `Week ${week}`,
      submissions: count
    })).sort((a, b) => a.week.localeCompare(b.week));

    // Role-specific metrics
    const teacherPerformance = profile.role !== 'teacher' ? Object.entries(
      notes.reduce((acc, note) => {
        if (!acc[note.teacherName]) acc[note.teacherName] = { total: 0, vetted: 0 };
        acc[note.teacherName].total++;
        if (note.status === 'vetted') acc[note.teacherName].vetted++;
        return acc;
      }, {} as Record<string, { total: number, vetted: number }>)
    ).map(([name, stats]) => ({ name, ...stats })) : [];

    const teacherSubmissionStatus = (profile.role === 'headteacher' || profile.role === 'siso') ? teachers.map(teacher => {
      const hasSubmitted = notes.some(n => n.teacherId === teacher.uid && n.week === currentWeek && !n.isArchived);
      return {
        ...teacher,
        hasSubmitted
      };
    }) : [];

    const schoolPerformance = profile.role === 'siso' ? Object.entries(
      notes.reduce((acc, note) => {
        if (!acc[note.schoolId]) acc[note.schoolId] = { total: 0 };
        acc[note.schoolId].total++;
        return acc;
      }, {} as Record<string, { total: number }>)
    ).map(([schoolId, stats]) => {
      const school = schools.find(s => s.id === schoolId);
      return { 
        school: school?.name || schoolId, 
        emisCode: schoolId,
        ...stats 
      };
    }) : [];

    const recentFeedback = profile.role === 'teacher' 
      ? notes.filter(n => n.feedback && n.status !== 'pending').slice(0, 5)
      : [];

    // Teacher-specific insights
    const successRate = total > 0 ? Math.round((vetted / total) * 100) : 0;
    
    // Submission Consistency (percentage of weeks with at least one submission)
    const uniqueWeeks = new Set(notes.map(n => n.week)).size;
    const consistencyScore = Math.min(100, Math.round((uniqueWeeks / 12) * 100)); // Assuming 12 weeks in a term

    // Subject-wise Success Rate
    const subjectStats = profile.role === 'teacher' ? Object.entries(
      notes.reduce((acc, note) => {
        if (!acc[note.subject]) acc[note.subject] = { total: 0, vetted: 0 };
        acc[note.subject].total++;
        if (note.status === 'vetted') acc[note.subject].vetted++;
        return acc;
      }, {} as Record<string, { total: number, vetted: number }>)
    ).map(([subject, stats]) => ({
      subject,
      rate: Math.round((stats.vetted / stats.total) * 100)
    })) : [];
    
    // Feedback patterns (keyword frequency analysis)
    const stopWords = new Set(['this', 'that', 'with', 'from', 'your', 'have', 'been', 'very', 'please', 'they', 'them', 'their', 'there', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'whose', 'why', 'will', 'would', 'could', 'should', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'bulk', 'vetted', 'rejected', 'headteacher', 'siso']);
    
    const feedbackPatterns = profile.role === 'teacher' ? Object.entries(
      notes.reduce((acc, note) => {
        if (note.feedback) {
          // Extract words, filter by length and stop words
          const words = note.feedback.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));
          
          words.forEach(w => {
            acc[w] = (acc[w] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word, count })) : [];

    // Vetting Overdue Check (for headteachers/SISO)
    const overdueVettingCount = notes.filter(n => {
      if (n.status !== 'pending') return false;
      const submittedDate = new Date(n.submittedAt);
      const now = new Date();
      const diffHours = (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60);
      return diffHours > 48; // 48 hours deadline
    }).length;

    return {
      total,
      vetted,
      pending,
      rejected,
      overdueVettingCount,
      successRate,
      consistencyScore,
      subjectStats,
      avgVettingTimeHours,
      chartData,
      barData,
      teacherPerformance,
      schoolPerformance,
      recentFeedback,
      feedbackPatterns,
      teacherSubmissionStatus
    };
  }, [notes, profile, teachers, currentWeek]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-stone-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-stone-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="mb-6 inline-flex p-4 bg-emerald-500/10 rounded-3xl">
              <School className="w-12 h-12 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">EduVette</h1>
            <p className="text-stone-400 text-lg">Lesson Note Submission & Vetting</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex gap-2 mb-8 p-1 bg-white/5 rounded-xl">
              <button 
                onClick={() => { setLoginMode('staff-login'); setLoginError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${loginMode === 'staff-login' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-stone-400 hover:text-white'}`}
              >
                Login
              </button>
              <button 
                onClick={() => { setLoginMode('staff-register'); setLoginError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${loginMode === 'staff-register' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-stone-400 hover:text-white'}`}
              >
                Register
              </button>
            </div>

            {loginMode === 'staff-login' ? (
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Login As</label>
                  <select 
                    value={loginRole || 'teacher'}
                    onChange={(e) => setLoginRole(e.target.value as UserRole)}
                    required
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none appearance-none"
                  >
                    <option value="teacher" className="bg-stone-900">Teacher</option>
                    <option value="headteacher" className="bg-stone-900">Headteacher</option>
                    <option value="siso" className="bg-stone-900">SISO (Administrator)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={loginName || ''}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-stone-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                    placeholder="Enter your registered name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">EMIS Code</label>
                  <input 
                    type="text"
                    required
                    value={loginSchoolId || ''}
                    onChange={(e) => setLoginSchoolId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-stone-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                    placeholder="Enter EMIS code"
                  />
                </div>
                {loginError && (
                  <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {loginError}
                  </p>
                )}
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 mt-2"
                >
                  Sign In
                </button>
              </form>
            ) : loginMode === 'staff-register' ? (
              <form onSubmit={handleStaffRegister} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                  <input 
                    name="name"
                    type="text"
                    required
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-stone-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Your Role</label>
                  <select 
                    name="role"
                    required
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none appearance-none"
                  >
                    <option value="teacher" className="bg-stone-900">Teacher</option>
                    <option value="headteacher" className="bg-stone-900">Headteacher</option>
                    <option value="siso" className="bg-stone-900">SISO (Administrator)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">EMIS Code</label>
                  <input 
                    name="emisCode"
                    type="text"
                    required
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-stone-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                    placeholder="Enter unique EMIS code"
                  />
                </div>
                {loginError && (
                  <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {loginError}
                  </p>
                )}
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 mt-2"
                >
                  Create Account
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={handleLogin}
                  className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-stone-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Continue with Google
                </button>
                <button 
                  onClick={() => setLoginMode('staff-login')}
                  className="w-full py-3 text-stone-400 text-sm font-medium hover:text-white transition-all"
                >
                  Back to Staff Login
                </button>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-white/10 text-center">
              <button 
                onClick={() => setLoginMode('google')}
                className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em] hover:text-emerald-400 transition-all"
              >
                Developer Access
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isNewUser) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-100">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Complete Your Profile</h2>
            <p className="text-stone-500 text-sm">Please provide your school details to continue.</p>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const role = formData.get('role') as UserRole;
            const emisCode = formData.get('emisCode') as string;
            const name = formData.get('name') as string;

            // Validate emisCode
            const school = schools.find(s => s.id === emisCode);
            if (!school && role !== 'siso') {
              setSchoolCodeError('Invalid EMIS code. Please contact Edubyte Africa Inc (0543521863 - Call/WhatsApp) to make payment and obtain a valid license code.');
              addToast('Invalid EMIS code.', 'error');
              return;
            }
            setSchoolCodeError(null);

            try {
              const newProfile: UserProfile = {
                uid: user.uid,
                name: name || user.displayName || 'Anonymous',
                email: user.email || '',
                role,
                schoolId: role === 'siso' ? 'DISTRICT_OFFICE' : emisCode,
              };
              await setDoc(doc(db, 'users', user.uid), newProfile);
              setProfile(newProfile);
              setIsNewUser(false);
              addToast('Profile completed successfully!', 'success');
            } catch (error) {
              console.error('Error completing profile:', error);
              addToast('Failed to complete profile.', 'error');
            }
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Full Name</label>
              <input 
                name="name"
                type="text" 
                defaultValue={user.displayName || ''}
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Your Role</label>
              <select 
                name="role"
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none bg-white"
              >
                <option value="teacher">Teacher</option>
                <option value="headteacher">Headteacher</option>
                <option value="siso">SISO (Administrator)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">EMIS Code</label>
              <input 
                name="emisCode"
                type="text" 
                required
                className={`w-full px-4 py-3 rounded-xl border ${schoolCodeError ? 'border-red-500 focus:ring-red-500' : 'border-stone-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent transition-all outline-none`}
                placeholder="Enter unique EMIS code"
                onChange={() => setSchoolCodeError(null)}
              />
              {schoolCodeError ? (
                <p className="mt-1.5 text-[10px] text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {schoolCodeError}
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] text-stone-400 italic">
                  Contact Edubyte Africa Inc (0543521863) to make payment and get your EMIS code.
                </p>
              )}
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] mt-4 shadow-lg shadow-emerald-600/20"
            >
              Finish Setup
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f8f9fa] flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                <School className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">EduVette</span>
            </div>

            <nav className="space-y-2">
              <button 
                onClick={() => setView('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </button>
              
              {profile.role === 'teacher' && (
                <button 
                  onClick={() => setView('submit')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'submit' ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
                >
                  <Plus className="w-5 h-5" />
                  Submit Note
                </button>
              )}

              <button 
                onClick={() => setView('list')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'list' ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                <FileText className="w-5 h-5" />
                {profile.role === 'teacher' ? 'My Notes' : 'Submissions'}
              </button>

              {profile.role === 'siso' && (
                <>
                  <button 
                    onClick={() => {
                      setView('settings');
                      setShowSchoolManagement(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'settings' ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
                  >
                    <Settings className="w-5 h-5" />
                    Term Settings
                  </button>
                  <button 
                    onClick={() => {
                      setShowSchoolManagement(true);
                      setView('dashboard');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${showSchoolManagement ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
                  >
                    <School className="w-5 h-5" />
                    EMIS Codes
                  </button>
                  <button 
                    onClick={() => {
                      setView('users');
                      setShowSchoolManagement(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'users' ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
                  >
                    <UserIcon className="w-5 h-5" />
                    User Management
                  </button>
                </>
              )}
            </nav>
          </div>

          {user?.email === 'flekufelix@gmail.com' && (
            <div className="mt-auto p-8 border-t border-stone-100">
              <div className="mb-6">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">Demo: Switch Role</label>
                <div className="flex gap-1">
                  {(['teacher', 'headteacher', 'siso'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => switchRole(r)}
                      className={`flex-1 text-[10px] py-1 rounded-md border transition-all ${profile.role === r ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{profile.name}</p>
                  <p className="text-xs text-stone-400 capitalize">{profile.role}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-500 hover:bg-stone-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          )}

          {user?.email !== 'flekufelix@gmail.com' && (
            <div className="mt-auto p-8 border-t border-stone-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{profile.name}</p>
                  <p className="text-xs text-stone-400 capitalize">{profile.role}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-500 hover:bg-stone-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-12 overflow-y-auto">
          <header className="mb-12 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 mb-2">
                {view === 'dashboard' && 'System Overview'}
                {view === 'submit' && 'New Lesson Note'}
                {view === 'list' && (profile.role === 'teacher' ? 'My Submissions' : 'All Submissions')}
                {view === 'settings' && 'Termly Settings'}
              </h2>
              <p className="text-stone-500">
                {format(new Date(), 'EEEE, MMMM do yyyy')}
              </p>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 bg-white border border-stone-200 rounded-2xl text-stone-500 hover:border-emerald-500 hover:text-emerald-600 transition-all relative group"
              >
                <Bell className="w-6 h-6" />
                {appNotifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-4 w-96 bg-white border border-stone-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                    <h3 className="font-bold text-stone-900">Notifications</h3>
                    <button 
                      onClick={async () => {
                        const batch = writeBatch(db);
                        appNotifications.filter(n => !n.isRead).forEach(n => {
                          batch.update(doc(db, 'notifications', n.id), { isRead: true });
                        });
                        await batch.commit();
                      }}
                      className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {appNotifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <Bell className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                        <p className="text-stone-400 text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      appNotifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={async () => {
                            if (!n.isRead) await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
                            if (n.link) {
                              setView('list');
                              setSearchTerm(n.link);
                            }
                            setShowNotifications(false);
                          }}
                          className={`p-6 border-b border-stone-50 hover:bg-stone-50 transition-all cursor-pointer relative ${!n.isRead ? 'bg-emerald-50/30' : ''}`}
                        >
                          {!n.isRead && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              n.type === 'deadline' ? 'bg-amber-100 text-amber-600' :
                              n.type === 'overdue' || n.type === 'vetting_overdue' ? 'bg-rose-100 text-rose-600' :
                              n.type === 'vetted' ? 'bg-emerald-100 text-emerald-600' :
                              'bg-stone-100 text-stone-600'
                            }`}>
                              {n.type === 'deadline' && <Timer className="w-5 h-5" />}
                              {(n.type === 'overdue' || n.type === 'vetting_overdue') && <AlertCircle className="w-5 h-5" />}
                              {n.type === 'vetted' && <CheckCircle2 className="w-5 h-5" />}
                              {n.type === 'rejected' && <XCircle className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-900 mb-1">{n.title}</p>
                              <p className="text-xs text-stone-500 leading-relaxed mb-2">{n.message}</p>
                              <p className="text-[10px] text-stone-400 font-medium">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          {view === 'dashboard' && (
            <div className="space-y-8">
              {/* Role-specific Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-500 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Welcome back, {profile.name}!</h2>
                  <p className="text-emerald-100 text-sm">
                    {profile.role === 'teacher' && "Track your lesson note submissions and vetting status."}
                    {profile.role === 'headteacher' && `Managing vetting for ${profile.schoolId}.`}
                    {profile.role === 'siso' && "Overseeing all school submissions and vetting performance."}
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {profile.role === 'teacher' && <UserIcon className="w-5 h-5" />}
                    {profile.role === 'headteacher' && <School className="w-5 h-5" />}
                    {profile.role === 'siso' && <BarChart3 className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Current Role</p>
                    <p className="text-sm font-bold">{profile.role.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {[
                  { label: 'Total Notes', value: metrics.total, icon: FileText, color: 'bg-blue-50 text-blue-600' },
                  { label: 'Vetted', value: metrics.vetted, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Pending', value: metrics.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
                  { label: profile.role === 'teacher' ? 'Rejected' : 'Overdue Vetting', value: profile.role === 'teacher' ? metrics.rejected : metrics.overdueVettingCount, icon: profile.role === 'teacher' ? XCircle : AlertCircle, color: profile.role === 'teacher' ? 'bg-rose-50 text-rose-600' : 'bg-rose-50 text-rose-600' },
                  { label: 'Avg. Vetting Time', value: `${metrics.avgVettingTimeHours}h`, icon: Timer, color: 'bg-indigo-50 text-indigo-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                    <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <p className="text-stone-500 text-sm font-medium mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-stone-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Charts & Role-Specific Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Submissions by Week
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="submissions" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Vetting Status
                  </h3>
                  <div className="h-80 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.chartData}
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {metrics.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-bold text-stone-900">{metrics.total}</span>
                      <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">Total</span>
                    </div>
                  </div>
                </div>

                {/* Role-Specific Dashboard Sections */}
                {profile.role === 'teacher' && (
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Target className="w-5 h-5" />
                          </div>
                          <h3 className="font-bold text-stone-900 text-sm">Success Rate</h3>
                        </div>
                        <p className="text-3xl font-bold text-emerald-500 mb-1">{metrics.successRate}%</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider">Overall Vetting Success</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                          <h3 className="font-bold text-stone-900 text-sm">Consistency</h3>
                        </div>
                        <p className="text-3xl font-bold text-blue-500 mb-1">{metrics.consistencyScore}%</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider">Weekly Submission Rate</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Timer className="w-5 h-5" />
                          </div>
                          <h3 className="font-bold text-stone-900 text-sm">Vetting Speed</h3>
                        </div>
                        <p className="text-3xl font-bold text-indigo-500 mb-1">{metrics.avgVettingTimeHours}h</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider">Avg. Time to Vetting</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <h3 className="font-bold text-stone-900 text-sm">Feedback</h3>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {metrics.feedbackPatterns.length > 0 ? metrics.feedbackPatterns.map((p, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[9px] font-bold uppercase tracking-wider">
                              {p.word}
                            </span>
                          )) : <span className="text-[10px] text-stone-400 italic">No patterns</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                        <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-emerald-500" />
                          Subject-wise Vetting Performance
                        </h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.subjectStats} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                              <YAxis dataKey="subject" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} width={100} />
                              <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                              />
                              <Bar dataKey="rate" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="space-y-8">
                        {/* Feedback Keyword Analysis */}
                        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-emerald-500" />
                            Common Feedback Keywords
                          </h3>
                          <div className="space-y-4">
                            {metrics.feedbackPatterns.length > 0 ? metrics.feedbackPatterns.map((p, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-stone-500">
                                    #{i + 1}
                                  </div>
                                  <span className="text-sm font-medium text-stone-700 capitalize">{p.word}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="hidden sm:block h-1.5 w-24 bg-stone-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full" 
                                      style={{ width: `${(p.count / metrics.feedbackPatterns[0].count) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                    {p.count}
                                  </span>
                                </div>
                              </div>
                            )) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-stone-400 italic">No feedback patterns identified yet.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            Recent Vetting Feedback
                          </h3>
                          <div className="space-y-4">
                            {metrics.recentFeedback.length > 0 ? metrics.recentFeedback.map((note) => (
                              <div key={note.id} className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{note.subject}</span>
                                  <Badge status={note.status} />
                                </div>
                                <p className="text-xs text-stone-600 line-clamp-2 italic">"{note.feedback}"</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-[8px] font-bold">
                                    {note.vetterName?.charAt(0)}
                                  </div>
                                  <span className="text-[9px] text-stone-400">Vetted by {note.vetterName}</span>
                                </div>
                              </div>
                            )) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-stone-400 italic">No feedback history yet.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {profile.role === 'headteacher' && metrics.teacherPerformance.length > 0 && (
                  <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 text-stone-900">Teacher Submission Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {metrics.teacherPerformance.map((teacher, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-stone-900">{teacher.name}</p>
                            <p className="text-xs text-stone-400">{teacher.total} Submissions</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-500 font-bold">{Math.round((teacher.vetted / teacher.total) * 100)}%</p>
                            <p className="text-[10px] text-stone-400 uppercase font-bold">Vetted</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(profile.role === 'headteacher' || profile.role === 'siso') && metrics.teacherSubmissionStatus.length > 0 && (
                  <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">Teacher Submission Status (Week {currentWeek})</h3>
                        <p className="text-xs text-stone-400">Monitor real-time submissions for the current week.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Missing</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {metrics.teacherSubmissionStatus.map((teacher) => (
                        <div key={teacher.uid} className={`p-6 rounded-2xl border transition-all ${teacher.hasSubmitted ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${teacher.hasSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                <UserIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-bold text-stone-900 text-sm">{teacher.name}</p>
                                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">{teacher.schoolId}</p>
                              </div>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${teacher.hasSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {teacher.hasSubmitted ? 'Submitted' : 'Missing'}
                            </div>
                          </div>
                          {!teacher.hasSubmitted && (
                            <button 
                              onClick={() => triggerAlert(teacher)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-500/20"
                            >
                              <Bell className="w-4 h-4" />
                              Trigger Alert
                            </button>
                          )}
                          {teacher.hasSubmitted && (
                            <div className="w-full py-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold text-center">
                              All set for Week {currentWeek}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.role === 'siso' && metrics.schoolPerformance.length > 0 && (
                  <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 text-stone-900">School Performance Tracking</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {metrics.schoolPerformance.map((school, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-stone-50 border border-stone-100">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                              <School className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-stone-900">{school.school}</p>
                              <p className="text-[10px] text-stone-400 font-mono uppercase tracking-widest">EMIS: {school.emisCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
                            <span className="text-sm font-medium text-stone-500">Total Submissions</span>
                            <span className="font-bold text-stone-900">{school.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'settings' && profile.role === 'siso' && (
            <div className="max-w-2xl bg-white p-10 rounded-3xl shadow-sm border border-stone-200">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Academic Term Configuration</h3>
                  <p className="text-stone-500 text-sm">Set the current term and academic year for all submissions.</p>
                </div>
              </div>

              <form onSubmit={updateTermSettings} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Current Term</label>
                    <select 
                      name="currentTerm"
                      defaultValue={termSettings?.currentTerm || 'Term 1'}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Academic Year</label>
                    <input 
                      type="text"
                      name="academicYear"
                      defaultValue={termSettings?.academicYear || '2023/2024'}
                      placeholder="e.g. 2023/2024"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Important Note</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Changing these settings will affect all new lesson note submissions. Existing notes will retain their original term and year data.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
                >
                  Save Settings
                </button>
              </form>

              {termSettings && (
                <div className="mt-8 pt-8 border-t border-stone-100">
                  <p className="text-xs text-stone-400">
                    Last updated: {format(new Date(termSettings.updatedAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              )}
            </div>
          )}

          {view === 'users' && profile.role === 'siso' && (
            <div className="max-w-6xl bg-white p-10 rounded-3xl shadow-sm border border-stone-200">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">User Management</h3>
                  <p className="text-stone-500 text-sm">Manage roles and permissions for teachers and headteachers.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="py-4 px-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Name</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest">School</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Current Role</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((u) => (
                      <tr key={u.uid} className="border-b border-stone-50 hover:bg-stone-50/50 transition-all group">
                        <td className="py-4 px-6">
                          <p className="font-bold text-stone-900">{u.name}</p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-stone-500">{u.email}</p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-stone-700 font-medium">
                            {schools.find(s => s.id === u.schoolId)?.name || u.schoolId}
                          </p>
                          <p className="text-[10px] text-stone-400 font-mono">EMIS: {u.schoolId}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'headteacher' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            {u.role === 'teacher' && (
                              <button 
                                onClick={() => updateUserRole(u.uid, 'headteacher')}
                                className="px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                              >
                                Promote to Headteacher
                              </button>
                            )}
                            {u.role === 'headteacher' && (
                              <button 
                                onClick={() => updateUserRole(u.uid, 'teacher')}
                                className="px-3 py-1.5 bg-stone-500 text-white text-[10px] font-bold rounded-lg hover:bg-stone-600 transition-all"
                              >
                                Demote to Teacher
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'submit' && (
            <div className="max-w-3xl bg-white p-10 rounded-3xl border border-stone-200 shadow-sm">
              <form onSubmit={submitNote} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-700">Subject</label>
                    <input 
                      name="subject" 
                      required 
                      placeholder="e.g. Mathematics"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-700">Week Number</label>
                    <input 
                      name="week" 
                      type="number" 
                      required 
                      min="1"
                      placeholder="e.g. 5"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">Lesson Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">Note Content (Optional)</label>
                  <textarea 
                    name="content" 
                    rows={8}
                    placeholder="Enter lesson objectives, activities, and evaluation..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  ></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-700">Lesson Note File (Mandatory)</label>
                    <div className="relative group">
                      <input 
                        name="file" 
                        type="file" 
                        required
                        accept=".pdf,.doc,.docx,.png,.jpg"
                        onChange={(e) => handleFileChange(e, 'main')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`w-full px-4 py-3 rounded-xl border border-dashed transition-all flex items-center gap-3 ${mainFilePreview ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-stone-200 bg-stone-50 text-stone-500 group-hover:border-emerald-500 group-hover:bg-emerald-50'}`}>
                        <FileUp className="w-5 h-5" />
                        <span className="text-sm truncate">{mainFilePreview ? mainFilePreview.name : 'Click to upload lesson note'}</span>
                      </div>
                    </div>
                    {mainUploadProgress !== null && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-stone-500">
                          <span>Uploading...</span>
                          <span>{mainUploadProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                            style={{ width: `${mainUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {mainFilePreview && (
                      <div className="mt-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">File Preview</span>
                          <button type="button" onClick={() => { setMainFilePreview(null); setMainFile(null); }} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-all">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="bg-white rounded-xl border border-stone-100 overflow-hidden flex flex-col min-h-[300px]">
                          <div className="flex justify-end p-2 bg-stone-50 border-b border-stone-100">
                            <button 
                              type="button"
                              onClick={() => setPreviewFile({ url: mainFilePreview.url, type: mainFilePreview.type, name: mainFilePreview.name })}
                              className="flex items-center gap-1.5 px-3 py-1 bg-white text-stone-600 text-[10px] font-bold rounded-lg border border-stone-200 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Full Screen
                            </button>
                          </div>
                          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                            {mainFilePreview.type.startsWith('image/') ? (
                              <img src={mainFilePreview.url} alt="Preview" className="max-h-full object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <DocumentPreview 
                                fileUrl={mainFilePreview.url} 
                                fileType={mainFilePreview.type} 
                                fileName={mainFilePreview.name} 
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-stone-400">Max size: 1MB (Demo Limit)</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Other TLRs (Optional)</label>
                      <input 
                        name="tlrs" 
                        placeholder="e.g. Teaching Learning Resources"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Support Files (Image/Video/File)</label>
                      <div className="relative group">
                        <input 
                          name="tlrFile" 
                          type="file" 
                          accept="image/*,video/*,.pdf,.doc,.docx"
                          onChange={(e) => handleFileChange(e, 'tlr')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`w-full px-4 py-3 rounded-xl border border-dashed transition-all flex items-center gap-3 ${tlrFilePreview ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-stone-200 bg-stone-50 text-stone-500 group-hover:border-emerald-500 group-hover:bg-emerald-50'}`}>
                          <Upload className="w-5 h-5" />
                          <span className="text-sm truncate">{tlrFilePreview ? tlrFilePreview.name : 'Upload support material'}</span>
                        </div>
                      </div>
                      {tlrUploadProgress !== null && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-stone-500">
                            <span>Uploading...</span>
                            <span>{tlrUploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                              style={{ width: `${tlrUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {tlrFilePreview && (
                        <div className="mt-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">TLR Preview</span>
                            <button type="button" onClick={() => { setTlrFilePreview(null); setTlrFile(null); }} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-all">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden flex flex-col min-h-[200px]">
                            <div className="flex justify-end p-1.5 bg-stone-50 border-b border-stone-100">
                              <button 
                                type="button"
                                onClick={() => setPreviewFile({ url: tlrFilePreview.url, type: tlrFilePreview.type, name: tlrFilePreview.name })}
                                className="flex items-center gap-1 px-2 py-0.5 bg-white text-stone-600 text-[9px] font-bold rounded-md border border-stone-200 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
                              >
                                <Eye className="w-3 h-3" />
                                Full Screen
                              </button>
                            </div>
                            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
                              {tlrFilePreview.type.startsWith('image/') ? (
                                <img src={tlrFilePreview.url} alt="TLR Preview" className="max-h-full object-contain" referrerPolicy="no-referrer" />
                              ) : tlrFilePreview.type.startsWith('video/') ? (
                                <video src={tlrFilePreview.url} controls className="w-full h-full" />
                              ) : (
                                <DocumentPreview 
                                  fileUrl={tlrFilePreview.url} 
                                  fileType={tlrFilePreview.type} 
                                  fileName={tlrFilePreview.name} 
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit for Vetting
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-4">
              {selectedNoteIds.length > 0 && (profile.role === 'headteacher' || profile.role === 'siso') && (
                <div className="bg-stone-900 text-white p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold">
                      {selectedNoteIds.length} Selected
                    </div>
                    <p className="text-sm font-medium text-stone-300">Apply bulk action to selected notes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleBulkAction('vetted')}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve All
                    </button>
                    <button 
                      onClick={() => handleBulkAction('rejected')}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject All
                    </button>
                    <button 
                      onClick={() => setSelectedNoteIds([])}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-100 space-y-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input 
                      placeholder="Search by subject, teacher, or school..."
                      value={searchTerm || ''}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {(['all', 'pending', 'vetted', 'rejected'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === s ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${showArchived ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                    >
                      <FolderArchive className="w-4 h-4" />
                      {showArchived ? 'Archived' : 'Active'}
                    </button>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                      title="Toggle Advanced Filters"
                    >
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Subject</label>
                      <select 
                        value={subjectFilter || 'all'}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="all">All Subjects</option>
                        {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Week</label>
                      <select 
                        value={weekFilter || 'all'}
                        onChange={(e) => setWeekFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="all">All Weeks</option>
                        {uniqueWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Term</label>
                      <select 
                        value={termFilter || 'all'}
                        onChange={(e) => setTermFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="all">All Terms</option>
                        {uniqueTerms.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">Year</label>
                      <select 
                        value={yearFilter || 'all'}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="all">All Years</option>
                        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">From Date</label>
                      <input 
                        type="date"
                        value={startDateFilter || ''}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 ml-1">To Date</label>
                      <input 
                        type="date"
                        value={endDateFilter || ''}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="lg:col-span-6 flex justify-end">
                      <button 
                        onClick={() => {
                          setSubjectFilter('all');
                          setWeekFilter('all');
                          setTermFilter('all');
                          setYearFilter('all');
                          setStartDateFilter('');
                          setEndDateFilter('');
                          setSearchTerm('');
                          setStatusFilter('all');
                        }}
                        className="text-xs font-bold text-rose-500 hover:underline"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50/50 text-stone-400 text-xs font-bold uppercase tracking-wider">
                    {(profile.role === 'headteacher' || profile.role === 'siso') && (
                      <th className="px-8 py-4 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedNoteIds.length === filteredNotes.length && filteredNotes.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-stone-300 text-emerald-500 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="px-8 py-4">Subject</th>
                    <th className="px-8 py-4">Teacher</th>
                    <th className="px-8 py-4">Week</th>
                    <th className="px-8 py-4">Term</th>
                    <th className="px-8 py-4">Year</th>
                    <th className="px-8 py-4">Submitted</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredNotes.map((note) => (
                    <tr key={note.id} className={`hover:bg-stone-50/50 transition-colors group ${selectedNoteIds.includes(note.id) ? 'bg-emerald-50/30' : ''}`}>
                      {(profile.role === 'headteacher' || profile.role === 'siso') && (
                        <td className="px-8 py-6">
                          <input 
                            type="checkbox" 
                            checked={selectedNoteIds.includes(note.id)}
                            onChange={() => toggleSelectNote(note.id)}
                            className="w-4 h-4 rounded border-stone-300 text-emerald-500 focus:ring-emerald-500"
                          />
                        </td>
                      )}
                      <td className="px-8 py-6">
                        <p className="font-bold text-stone-900">{note.subject}</p>
                        <p className="text-xs text-stone-400">{format(new Date(note.date), 'MMM dd, yyyy')}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-50">
                            {note.teacherName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-stone-900">{note.teacherName}</p>
                            <p className="text-[10px] text-stone-400 font-mono">EMIS: {note.schoolId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-stone-600">Week {note.week}</td>
                      <td className="px-8 py-6 text-sm text-stone-500">{note.term}</td>
                      <td className="px-8 py-6 text-sm text-stone-500">{note.academicYear}</td>
                      <td className="px-8 py-6 text-sm text-stone-400">
                        {format(new Date(note.submittedAt), 'MMM dd, HH:mm')}
                      </td>
                      <td className="px-8 py-6">
                        <Badge status={note.status} />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleNoteClick(note)}
                          className="p-2 text-stone-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredNotes.length === 0 && (
                    <tr>
                      <td colSpan={(profile.role === 'headteacher' || profile.role === 'siso') ? 9 : 8} className="px-8 py-20 text-center text-stone-400">
                        No submissions found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </main>

        {/* ChatBot */}
        <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        {/* Floating Chat Trigger */}
        {!isChatOpen && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95 z-40 group"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute right-full mr-4 px-3 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Ask AI Assistant
            </span>
          </button>
        )}

        {/* Modal / Detail View */}
        {selectedNote && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-bold text-stone-900">{selectedNote.subject}</h3>
                    <Badge status={selectedNote.status} />
                  </div>
                  <p className="text-stone-500">Submitted by {selectedNote.teacherName} • Week {selectedNote.week}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(profile.role === 'headteacher' || profile.role === 'siso') && (
                    <button 
                      onClick={() => archiveNote(selectedNote.id, !selectedNote.isArchived)}
                      className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                        selectedNote.isArchived 
                          ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                          : 'bg-stone-50 text-stone-400 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <Archive className="w-4 h-4" />
                      {selectedNote.isArchived ? 'Archived' : 'Archive'}
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedNote(null)}
                    className="p-2 hover:bg-stone-100 rounded-full transition-all"
                  >
                    <XCircle className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-stone-50/30">
                {/* File Attachment Section */}
                {(selectedNote.fileUrl || selectedNote.tlrs || selectedNote.tlrFileUrl) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {selectedNote.fileUrl && (
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Attached File</h4>
                        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-stone-900 truncate">{selectedNote.fileName}</p>
                              <p className="text-[10px] text-stone-400 uppercase tracking-wider">{selectedNote.fileType?.split('/')[1] || 'FILE'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setPreviewFile({ url: selectedNote.fileUrl!, type: selectedNote.fileType!, name: selectedNote.fileName! })}
                              className="p-2 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              title="Preview File"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <a 
                              href={selectedNote.fileUrl} 
                              download={selectedNote.fileName}
                              className="p-2 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              title="Download File"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedNote.tlrFileUrl && (
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">TLR Support File</h4>
                        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
                              <Paperclip className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-stone-900 truncate">{selectedNote.tlrFileName}</p>
                              <p className="text-[10px] text-stone-400 uppercase tracking-wider">{selectedNote.tlrFileType?.split('/')[1] || 'FILE'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setPreviewFile({ url: selectedNote.tlrFileUrl!, type: selectedNote.tlrFileType!, name: selectedNote.tlrFileName! })}
                              className="p-2 text-stone-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-all"
                              title="Preview File"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <a 
                              href={selectedNote.tlrFileUrl} 
                              download={selectedNote.tlrFileName}
                              className="p-2 text-stone-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-all"
                              title="Download File"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedNote.tlrs && !selectedNote.tlrFileUrl && (
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Other TLRs</h4>
                        <p className="text-sm text-stone-600 bg-stone-50 p-4 rounded-xl border border-stone-100 italic">
                          {selectedNote.tlrs}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedNote.tlrs && selectedNote.tlrFileUrl && (
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-8">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Other TLRs Description</h4>
                    <p className="text-sm text-stone-600 bg-stone-50 p-4 rounded-xl border border-stone-100 italic">
                      {selectedNote.tlrs}
                    </p>
                  </div>
                )}

                <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm mb-8">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Lesson Content</h4>
                  <div className="prose prose-stone max-w-none whitespace-pre-wrap text-stone-700 leading-relaxed">
                    {selectedNote.content}
                  </div>
                </div>

                {selectedNote.feedback && (
                  <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 mb-8">
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Latest Feedback</h4>
                    <p className="text-amber-900">{selectedNote.feedback}</p>
                  </div>
                )}

                {selectedNote.vettingHistory && selectedNote.vettingHistory.length > 0 && (
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm mb-8">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Vetting History</h4>
                    <div className="space-y-6">
                      {selectedNote.vettingHistory.map((action, idx) => (
                        <div key={idx} className="flex gap-4 relative">
                          {idx !== selectedNote.vettingHistory!.length - 1 && (
                            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-stone-100"></div>
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                            action.status === 'vetted' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {action.status === 'vetted' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-bold text-stone-900">
                                {action.status === 'vetted' ? 'Vetted' : 'Rejected'} by {action.vettedByName}
                              </p>
                              <span className="text-xs text-stone-400">
                                {format(new Date(action.vettedAt), 'MMM dd, yyyy HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-stone-600 italic">"{action.feedback}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(profile.role === 'headteacher' || profile.role === 'siso') && selectedNote.status === 'pending' && (
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Vetting Action</h4>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const feedback = new FormData(e.currentTarget).get('feedback') as string;
                      vetNote(selectedNote.id, vettingStatus, feedback);
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Select Status</label>
                        <select
                          value={vettingStatus || 'vetted'}
                          onChange={(e) => setVettingStatus(e.target.value as 'vetted' | 'rejected')}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                        >
                          <option value="vetted">Vetted (Approved)</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Feedback</label>
                        <textarea 
                          name="feedback" 
                          placeholder="Add your feedback or corrections here..."
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                          rows={3}
                          required
                        ></textarea>
                      </div>
                      <button 
                        type="submit" 
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                          vettingStatus === 'vetted' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                        }`}
                      >
                        {vettingStatus === 'vetted' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        Submit Vetting Action
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Preview Overlay */}
        {previewFile && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-10">
            <div className="bg-white w-full max-w-5xl h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">{previewFile.name}</h3>
                    <p className="text-xs text-stone-400 uppercase tracking-widest">{previewFile.type}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-all"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden p-6 bg-stone-50">
                {previewFile.type.startsWith('image/') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <img src={previewFile.url} alt="Preview" className="max-h-full object-contain shadow-lg rounded-lg" referrerPolicy="no-referrer" />
                  </div>
                ) : previewFile.type.startsWith('video/') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <video src={previewFile.url} controls className="max-h-full rounded-lg shadow-lg" />
                  </div>
                ) : (
                  <DocumentPreview 
                    fileUrl={previewFile.url} 
                    fileType={previewFile.type} 
                    fileName={previewFile.name} 
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* School Management Modal */}
        {showSchoolManagement && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900 tracking-tight">EMIS Registration</h3>
                  <p className="text-stone-500 text-sm">Manage unique EMIS codes and school registration.</p>
                </div>
                <button 
                  onClick={() => setShowSchoolManagement(false)}
                  className="p-2 hover:bg-stone-200 rounded-xl transition-all"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (isRegisteringSchool) return;
                  setIsRegisteringSchool(true);
                  const formData = new FormData(e.currentTarget);
                  const id = formData.get('schoolId') as string;
                  const name = formData.get('schoolName') as string;
                  const district = formData.get('district') as string;

                  if (schools.some(s => s.id === id)) {
                    addToast('EMIS code already exists.', 'error');
                    setIsRegisteringSchool(false);
                    return;
                  }

                  try {
                    const newSchool: School = {
                      id,
                      name,
                      district,
                      createdAt: new Date().toISOString(),
                      createdBy: user?.uid || '',
                    };
                    await setDoc(doc(db, 'schools', id), newSchool);
                    addToast('School registered successfully!', 'success');
                    (e.target as HTMLFormElement).reset();
                  } catch (error) {
                    console.error('Error registering school:', error);
                    addToast('Failed to register school.', 'error');
                  } finally {
                    setIsRegisteringSchool(false);
                  }
                }} className="grid grid-cols-2 gap-4 mb-8 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="col-span-2">
                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">Register New School (EMIS)</h4>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 ml-1">EMIS Code</label>
                    <input 
                      name="emisCode"
                      type="text" 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                      placeholder="e.g. EMIS-12345"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 ml-1">School Name</label>
                    <input 
                      name="schoolName"
                      type="text" 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                      placeholder="e.g. Central High"
                    />
                  </div>
                  <div className="col-span-2 flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 ml-1">District</label>
                      <input 
                        name="district"
                        type="text" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                        placeholder="e.g. North District"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isRegisteringSchool}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                    >
                      {isRegisteringSchool ? <Clock className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Register
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 ml-1">Registered Schools ({schools.length})</h4>
                  {schools.length === 0 ? (
                    <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <School className="w-10 h-10 text-stone-200 mx-auto mb-2" />
                      <p className="text-stone-400 text-sm">No schools registered yet.</p>
                    </div>
                  ) : (
                    schools.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-stone-100 rounded-2xl hover:border-emerald-200 hover:shadow-sm transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-stone-50 text-stone-400 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                            <School className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{s.name}</p>
                            <p className="text-xs text-stone-400">{s.district} • EMIS: <span className="font-mono text-emerald-600">{s.id}</span></p>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this school? This may affect users registered under this code.')) {
                              try {
                                await deleteDoc(doc(db, 'schools', s.id));
                                addToast('School deleted successfully.', 'success');
                              } catch (error) {
                                console.error('Error deleting school:', error);
                                addToast('Failed to delete school.', 'error');
                              }
                            }
                          }}
                          className="p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toasts */}
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map(n => (
            <div 
              key={n.id} 
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-left-10 duration-300 ${
                n.type === 'success' 
                  ? 'bg-emerald-500 text-white border-emerald-400' 
                  : 'bg-rose-500 text-white border-rose-400'
              }`}
            >
              {n.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p className="text-sm font-bold">{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}
