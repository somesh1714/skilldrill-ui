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

const MAP = {
  SpeedRounded, GridViewRounded, TextFieldsRounded, TagRounded, SwapHorizRounded,
  SearchRounded, SortRounded, LinkRounded, LayersRounded, AllInclusiveRounded,
  AccountTreeRounded, ChangeHistoryRounded, HubRounded, LinearScaleRounded,
  BoltRounded, TableChartRounded, SpellcheckRounded, JoinInnerRounded,
  MemoryRounded, FunctionsRounded, ArchitectureRounded, CoffeeRounded,
}

export default function TopicIcon({ name, ...props }) {
  const Cmp = MAP[name] || CategoryRounded
  return <Cmp {...props} />
}
