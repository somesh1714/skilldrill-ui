import SpeedRounded from '@mui/icons-material/SpeedRounded'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import TextFieldsRounded from '@mui/icons-material/TextFieldsRounded'
import TagRounded from '@mui/icons-material/TagRounded'
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import SortRounded from '@mui/icons-material/SortRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import LayersRounded from '@mui/icons-material/LayersRounded'
import AllInclusiveRounded from '@mui/icons-material/AllInclusiveRounded'
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded'
import ChangeHistoryRounded from '@mui/icons-material/ChangeHistoryRounded'
import HubRounded from '@mui/icons-material/HubRounded'
import LinearScaleRounded from '@mui/icons-material/LinearScaleRounded'
import BoltRounded from '@mui/icons-material/BoltRounded'
import TableChartRounded from '@mui/icons-material/TableChartRounded'
import SpellcheckRounded from '@mui/icons-material/SpellcheckRounded'
import JoinInnerRounded from '@mui/icons-material/JoinInnerRounded'
import MemoryRounded from '@mui/icons-material/MemoryRounded'
import FunctionsRounded from '@mui/icons-material/FunctionsRounded'
import ArchitectureRounded from '@mui/icons-material/ArchitectureRounded'
import CoffeeRounded from '@mui/icons-material/CoffeeRounded'
import CategoryRounded from '@mui/icons-material/CategoryRounded'

// --- Java / Spring chapter icons ---
import DeveloperBoardRounded from '@mui/icons-material/DeveloperBoardRounded'
import DataObjectRounded from '@mui/icons-material/DataObjectRounded'
import InventoryRounded from '@mui/icons-material/InventoryRounded'
import ReportProblemRounded from '@mui/icons-material/ReportProblemRounded'
import FilterAltRounded from '@mui/icons-material/FilterAltRounded'
import CallSplitRounded from '@mui/icons-material/CallSplitRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import SyncAltRounded from '@mui/icons-material/SyncAltRounded'
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded'
import SettingsRounded from '@mui/icons-material/SettingsRounded'
import ApiRounded from '@mui/icons-material/ApiRounded'
import StorageRounded from '@mui/icons-material/StorageRounded'
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded'
import ShieldRounded from '@mui/icons-material/ShieldRounded'
import ScienceRounded from '@mui/icons-material/ScienceRounded'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import MonitorHeartRounded from '@mui/icons-material/MonitorHeartRounded'
import HealthAndSafetyRounded from '@mui/icons-material/HealthAndSafetyRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import TuneRounded from '@mui/icons-material/TuneRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'

// --- UI chrome icons referenced from data ---
import MenuBookRounded from '@mui/icons-material/MenuBookRounded'
import PatternRounded from '@mui/icons-material/PatternRounded'
import FormatListNumberedRounded from '@mui/icons-material/FormatListNumberedRounded'
import LibraryBooksRounded from '@mui/icons-material/LibraryBooksRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import ChecklistRounded from '@mui/icons-material/ChecklistRounded'
import TerminalRounded from '@mui/icons-material/TerminalRounded'
import BugReportRounded from '@mui/icons-material/BugReportRounded'

const MAP = {
  SpeedRounded, GridViewRounded, TextFieldsRounded, TagRounded, SwapHorizRounded,
  SearchRounded, SortRounded, LinkRounded, LayersRounded, AllInclusiveRounded,
  AccountTreeRounded, ChangeHistoryRounded, HubRounded, LinearScaleRounded,
  BoltRounded, TableChartRounded, SpellcheckRounded, JoinInnerRounded,
  MemoryRounded, FunctionsRounded, ArchitectureRounded, CoffeeRounded,

  DeveloperBoardRounded, DataObjectRounded, InventoryRounded, ReportProblemRounded,
  FilterAltRounded, CallSplitRounded, LockRounded, SyncAltRounded,
  RocketLaunchRounded, SettingsRounded, ApiRounded, StorageRounded,
  ReceiptLongRounded, ShieldRounded, ScienceRounded, BoltOutlined,
  MonitorHeartRounded, HealthAndSafetyRounded, SendRounded, TuneRounded,
  AutoAwesomeRounded,

  MenuBookRounded, PatternRounded, FormatListNumberedRounded, LibraryBooksRounded,
  MapRounded, ChecklistRounded, TerminalRounded, BugReportRounded,
}

export default function TopicIcon({ name, ...props }) {
  const Cmp = MAP[name] || CategoryRounded
  return <Cmp {...props} />
}
