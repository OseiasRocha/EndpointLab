import React, { useState } from 'react'
import './App.css'
import { Button, Divider, InputAdornment, List, ListItem, Stack, TextField } from '@mui/material'
import { Add, FilterList, Search } from '@mui/icons-material'

function addEndpoint() {
  console.log("Add endpoint called")
  // send the endpoint object to backend
}

function search(msg: string) {
  console.log(msg)
  // send string to backend to search in DB
}

function endpointsList() {
  return [
  <ListItem>1</ListItem>,
  <ListItem>6</ListItem>,
  <ListItem>6</ListItem>,
  <ListItem>7</ListItem>
]
}

function App() {
  const [count, setCount] = useState(0)
  const [text, setText] = useState("")
  const [endpoints] = useState()

  return (
    <Stack>
      <Stack direction="row">
        <TextField color='secondary' variant='filled' label="Search" slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start'>
                <Search color='secondary' />
              </InputAdornment>
            )
          }
        }} onChange={(event) => { search(event.target.value) }}>
        </TextField>
        <Button onClick={() => addEndpoint()} variant="contained" color='secondary' startIcon={<Add />}>Add</Button>
      </Stack>
      <Divider/>
      <List sx={{maxHeight:500, overflow: 'auto'}}>
      {
        endpointsList()
      }
      </List>
    </Stack>
  )
}

export default App
