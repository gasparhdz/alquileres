import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import Inquilinos from './Inquilinos';
import Propietarios from './Propietarios';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`clientes-tabpanel-${index}`}
      aria-labelledby={`clientes-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [tabValue, setTabValue] = useState(tabFromUrl ? parseInt(tabFromUrl) : 0);

  // Sincronizar tab con URL
  useEffect(() => {
    if (tabFromUrl !== null) {
      const tabNum = parseInt(tabFromUrl);
      if (!isNaN(tabNum) && tabNum !== tabValue) {
        setTabValue(tabNum);
      }
    }
  }, [tabFromUrl]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Actualizar URL sin recargar
    searchParams.set('tab', newValue.toString());
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="tabs de clientes">
          <Tab label="Propietarios" id="clientes-tab-0" aria-controls="clientes-tabpanel-0" />
          <Tab label="Inquilinos" id="clientes-tab-1" aria-controls="clientes-tabpanel-1" />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <Propietarios />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <Inquilinos />
      </TabPanel>
    </Box>
  );
}

